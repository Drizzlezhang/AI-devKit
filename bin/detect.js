#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const TTL_SECONDS = 7 * 24 * 60 * 60;
const PROJECT_FILE = path.join(process.cwd(), '.devkit', 'project.yaml');
const IGNORED_DIRS = new Set(['.git', 'node_modules', 'vendor', 'dist', 'build']);
const CODE_EXTENSIONS = new Set([
  '.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs', '.mts', '.cts',
  '.py', '.go', '.rs', '.java', '.kt', '.kts', '.swift', '.dart',
  '.sh', '.bash', '.zsh', '.rb', '.php', '.cs', '.cpp', '.cc', '.c', '.h', '.hpp',
]);

function main() {
  const command = process.argv[2];
  if (command === 'record-install') {
    recordInstalledSkills(process.argv.slice(3));
    return;
  }

  const forceRefresh = process.argv.includes('--refresh');
  const existing = readExistingProjectFile(PROJECT_FILE);
  const currentFingerprint = collectFingerprint(process.cwd());

  if (!forceRefresh && existing) {
    const invalidReason = getInvalidReason(existing, currentFingerprint);
    if (!invalidReason) {
      console.log('cache hit, skip');
      console.log(`project: ${existing.project.name || path.basename(process.cwd())}`);
      console.log(`scale: ${existing.project.scale || 'XS'}`);
      console.log(`languages: ${(existing.project.language || []).join(', ') || 'unknown'}`);
      return;
    }

    console.log(`${invalidReason}, rescan`);
  }

  if (forceRefresh) {
    console.log('refresh requested, rescan');
  }

  const analysis = analyzeProject(process.cwd(), currentFingerprint, existing);
  writeProjectFile(PROJECT_FILE, analysis);

  console.log(`project: ${analysis.project.name}`);
  console.log(`scale: ${analysis.project.scale}`);
  console.log(`languages: ${analysis.project.language.join(', ') || 'unknown'}`);
  console.log(`frameworks: ${analysis.project.framework.join(', ') || 'none'}`);
  console.log(`internal: ${analysis.byted_signals.is_internal ? 'yes' : 'no'}`);
}

function readExistingProjectFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return null;
  }

  const content = fs.readFileSync(filePath, 'utf8');
  return parseProjectYaml(content);
}

function recordInstalledSkills(skillNames) {
  if (skillNames.length === 0) {
    throw new Error('Missing skill names for record-install');
  }

  const existing = readExistingProjectFile(PROJECT_FILE);
  const fingerprint = collectFingerprint(process.cwd());
  const analysis = analyzeProject(process.cwd(), fingerprint, existing);
  const installedSkills = new Set(analysis.ai_configs.installed_skills);
  skillNames.forEach((skillName) => installedSkills.add(skillName));
  analysis.ai_configs.installed_skills = Array.from(installedSkills).sort();
  writeProjectFile(PROJECT_FILE, analysis);

  console.log(`recorded installed skills: ${analysis.ai_configs.installed_skills.join(', ')}`);
}

function getInvalidReason(existing, currentFingerprint) {
  const scannedAt = Date.parse(existing.scanned_at || '');
  const ttlSeconds = Number(existing.ttl_seconds || 0);

  if (!Number.isNaN(scannedAt) && ttlSeconds > 0) {
    const expiredAt = scannedAt + ttlSeconds * 1000;
    if (Date.now() > expiredAt) {
      return 'ttl expired';
    }
  }

  const keys = [
    'package_json_hash',
    'lockfile_hash',
    'go_mod_hash',
    'pyproject_hash',
    'git_remote',
  ];

  for (const key of keys) {
    if ((existing.fingerprint[key] || '') !== (currentFingerprint[key] || '')) {
      return 'fingerprint changed';
    }
  }

  return '';
}

function analyzeProject(rootDir, fingerprint, existing) {
  const packageJson = readJson(path.join(rootDir, 'package.json'));
  const goMod = readText(path.join(rootDir, 'go.mod'));
  const pyproject = readText(path.join(rootDir, 'pyproject.toml'));
  const fileStats = collectFileStats(rootDir);

  const language = detectLanguages({ packageJson, goMod, pyproject, fileStats });
  const framework = detectFrameworks({ packageJson, goMod, pyproject, rootDir });
  const loc = fileStats.loc;
  const moduleCount = computeModuleCount(rootDir, packageJson);
  const scale = detectScale(loc, moduleCount);
  const bytedSignals = detectBytedSignals({ packageJson, rootDir, goMod, pyproject, fingerprint });
  const installedSkills = existing && existing.ai_configs && Array.isArray(existing.ai_configs.installed_skills)
    ? existing.ai_configs.installed_skills
    : [];

  return {
    schema_version: 1,
    scanned_at: new Date().toISOString(),
    ttl_seconds: TTL_SECONDS,
    fingerprint,
    project: {
      name: detectProjectName({ rootDir, packageJson, goMod, pyproject }),
      language,
      framework,
      scale,
      loc,
      module_count: moduleCount,
      is_monorepo: detectMonorepo({ packageJson, rootDir }),
    },
    byted_signals: bytedSignals,
    ai_configs: {
      has_claude_md: fs.existsSync(path.join(rootDir, 'CLAUDE.md')),
      has_cursor_rules: fs.existsSync(path.join(rootDir, '.cursorrules')),
      installed_skills: installedSkills,
    },
    context_budget: {
      xs: 3000,
      s: 5000,
      m: 30000,
      l: 80000,
    },
  };
}

function collectFingerprint(rootDir) {
  return {
    package_json_hash: hashFile(path.join(rootDir, 'package.json')),
    lockfile_hash: hashFirstExistingFile(rootDir, ['pnpm-lock.yaml', 'package-lock.json', 'yarn.lock']),
    go_mod_hash: hashFile(path.join(rootDir, 'go.mod')),
    pyproject_hash: hashFile(path.join(rootDir, 'pyproject.toml')),
    git_remote: readGitRemote(rootDir),
  };
}

function hashFirstExistingFile(rootDir, files) {
  for (const file of files) {
    const hash = hashFile(path.join(rootDir, file));
    if (hash) {
      return hash;
    }
  }

  return '';
}

function hashFile(filePath) {
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    return '';
  }

  const content = fs.readFileSync(filePath);
  return `sha256:${crypto.createHash('sha256').update(content).digest('hex')}`;
}

function readGitRemote(rootDir) {
  const gitConfigPath = path.join(rootDir, '.git', 'config');
  if (!fs.existsSync(gitConfigPath)) {
    return '';
  }

  const config = fs.readFileSync(gitConfigPath, 'utf8');
  const match = config.match(/\[remote\s+"origin"\][^\[]*?url\s*=\s*(.+)/m);
  return match ? match[1].trim() : '';
}

function detectProjectName({ rootDir, packageJson, goMod, pyproject }) {
  if (packageJson && typeof packageJson.name === 'string' && packageJson.name.trim()) {
    return packageJson.name.trim();
  }

  if (goMod) {
    const match = goMod.match(/^module\s+(.+)$/m);
    if (match) {
      return match[1].trim().split('/').pop();
    }
  }

  if (pyproject) {
    const match = pyproject.match(/^name\s*=\s*["']([^"']+)["']/m);
    if (match) {
      return match[1].trim();
    }
  }

  return path.basename(rootDir);
}

function detectLanguages({ packageJson, goMod, pyproject, fileStats }) {
  const set = new Set();

  if (packageJson) {
    const dependencies = collectDependencyNames(packageJson);
    if (dependencies.size > 0 || hasPackageScripts(packageJson)) {
      set.add('javascript');
    }
    if (hasTypeScript(packageJson, fileStats.extensions)) {
      set.add('typescript');
    }
  }

  if (goMod) {
    set.add('go');
  }

  if (pyproject) {
    set.add('python');
  }

  if (fileStats.extensions.has('.rs')) {
    set.add('rust');
  }
  if (fileStats.extensions.has('.java')) {
    set.add('java');
  }
  if (fileStats.extensions.has('.kt') || fileStats.extensions.has('.kts')) {
    set.add('kotlin');
  }
  if (fileStats.extensions.has('.swift')) {
    set.add('swift');
  }
  if (fileStats.extensions.has('.dart')) {
    set.add('dart');
  }
  if (fileStats.extensions.has('.sh') || fileStats.extensions.has('.bash') || fileStats.extensions.has('.zsh')) {
    set.add('shell');
  }

  return Array.from(set);
}

function hasTypeScript(packageJson, extensions) {
  const dependencyNames = collectDependencyNames(packageJson);
  return dependencyNames.has('typescript') || extensions.has('.ts') || extensions.has('.tsx') || extensions.has('.mts') || extensions.has('.cts');
}

function hasPackageScripts(packageJson) {
  return !!(packageJson && packageJson.scripts && Object.keys(packageJson.scripts).length > 0);
}

function detectFrameworks({ packageJson, goMod, pyproject, rootDir }) {
  const frameworks = new Set();
  const dependencies = packageJson ? collectDependencyNames(packageJson) : new Set();

  if (dependencies.has('react')) frameworks.add('react');
  if (dependencies.has('next')) frameworks.add('nextjs');
  if (dependencies.has('vue')) frameworks.add('vue');
  if (dependencies.has('nuxt') || dependencies.has('nuxt3')) frameworks.add('nuxt');
  if (dependencies.has('express')) frameworks.add('express');
  if (dependencies.has('@nestjs/core')) frameworks.add('nestjs');
  if (dependencies.has('electron')) frameworks.add('electron');
  if (dependencies.has('vite')) frameworks.add('vite');
  if (dependencies.has('turbo')) frameworks.add('turbo');
  if (dependencies.has('nx')) frameworks.add('nx');
  if (dependencies.has('lerna')) frameworks.add('lerna');
  if (dependencies.has('pnpm')) frameworks.add('pnpm');

  if (goMod) {
    if (goMod.includes('github.com/gin-gonic/gin')) frameworks.add('gin');
    if (goMod.includes('github.com/gofiber/fiber')) frameworks.add('fiber');
  }

  if (pyproject) {
    if (/fastapi/i.test(pyproject)) frameworks.add('fastapi');
    if (/django/i.test(pyproject)) frameworks.add('django');
    if (/flask/i.test(pyproject)) frameworks.add('flask');
    if (/poetry/i.test(pyproject)) frameworks.add('poetry');
  }

  if (fs.existsSync(path.join(rootDir, 'pnpm-workspace.yaml'))) frameworks.add('pnpm-workspace');
  if (fs.existsSync(path.join(rootDir, 'turbo.json'))) frameworks.add('turbo');
  if (fs.existsSync(path.join(rootDir, 'rush.json'))) frameworks.add('rush');

  return Array.from(frameworks);
}

function detectMonorepo({ packageJson, rootDir }) {
  if (fs.existsSync(path.join(rootDir, 'pnpm-workspace.yaml'))) return true;
  if (fs.existsSync(path.join(rootDir, 'turbo.json'))) return true;
  if (fs.existsSync(path.join(rootDir, 'rush.json'))) return true;
  if (fs.existsSync(path.join(rootDir, 'nx.json'))) return true;
  if (packageJson && Array.isArray(packageJson.workspaces) && packageJson.workspaces.length > 0) return true;
  if (packageJson && packageJson.workspaces && Array.isArray(packageJson.workspaces.packages) && packageJson.workspaces.packages.length > 0) return true;
  return false;
}

function collectFileStats(rootDir) {
  const extensions = new Set();
  let loc = 0;

  walkDirectory(rootDir, (filePath, entry) => {
    if (!entry.isFile()) {
      return;
    }

    const extension = path.extname(filePath);
    if (!CODE_EXTENSIONS.has(extension)) {
      return;
    }

    extensions.add(extension);
    loc += countLines(fs.readFileSync(filePath, 'utf8'));
  });

  return { loc, extensions };
}

function walkDirectory(rootDir, visitor) {
  const entries = fs.readdirSync(rootDir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(rootDir, entry.name);

    if (entry.isDirectory()) {
      if (IGNORED_DIRS.has(entry.name)) {
        continue;
      }
      walkDirectory(fullPath, visitor);
      continue;
    }

    visitor(fullPath, entry);
  }
}

function countLines(content) {
  if (!content) {
    return 0;
  }
  return content.split(/\r?\n/).length;
}

function computeModuleCount(rootDir, packageJson) {
  if (detectMonorepo({ packageJson, rootDir })) {
    const packagesDir = path.join(rootDir, 'packages');
    if (fs.existsSync(packagesDir) && fs.statSync(packagesDir).isDirectory()) {
      return fs.readdirSync(packagesDir, { withFileTypes: true }).filter((entry) => entry.isDirectory()).length;
    }
  }

  const topLevelDirs = fs.readdirSync(rootDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !IGNORED_DIRS.has(entry.name) && !entry.name.startsWith('.'));

  return topLevelDirs.length;
}

function detectScale(loc, moduleCount) {
  const score = Math.max(loc, moduleCount * 400);
  if (score < 500) return 'XS';
  if (score < 3000) return 'S';
  if (score < 15000) return 'M';
  return 'L';
}

function detectBytedSignals({ packageJson, rootDir, goMod, pyproject, fingerprint }) {
  const strong = [];
  const weak = [];
  const dependencies = packageJson ? collectDependencyNames(packageJson) : new Set();
  const packageJsonText = readText(path.join(rootDir, 'package.json'));
  const npmrcText = readText(path.join(rootDir, '.npmrc'));

  if (/bytedance|byted/i.test(fingerprint.git_remote)) {
    strong.push('git_remote_match');
  }
  if (/bnpm\.byted\.org/i.test(`${packageJsonText}\n${npmrcText}`)) {
    strong.push('bnpm_registry');
  }
  if (fs.existsSync(path.join(rootDir, '.byted')) || fs.existsSync(path.join(rootDir, 'byted.config.js'))) {
    strong.push('byted_config');
  }

  if (dependencies.has('@larksuiteoapi/node-sdk') || dependencies.has('@larksuiteoapi/openapi')) {
    weak.push('lark_sdk');
  }
  if (fs.existsSync(path.join(rootDir, 'rush.json'))) {
    weak.push('rush_tool');
  }
  if (/eden/i.test(packageJsonText) || /eden/i.test(goMod || '') || /eden/i.test(pyproject || '')) {
    weak.push('eden_tool');
  }

  return {
    strong,
    weak,
    is_internal: strong.length > 0,
  };
}

function collectDependencyNames(packageJson) {
  const names = new Set();
  ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies'].forEach((key) => {
    const source = packageJson && packageJson[key];
    if (!source || typeof source !== 'object') {
      return;
    }
    Object.keys(source).forEach((name) => names.add(name));
  });
  return names;
}

function readJson(filePath) {
  if (!fs.existsSync(filePath)) {
    return null;
  }

  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    return null;
  }
}

function readText(filePath) {
  if (!fs.existsSync(filePath)) {
    return '';
  }
  return fs.readFileSync(filePath, 'utf8');
}

function writeProjectFile(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, toProjectYaml(data), 'utf8');
}

function toProjectYaml(data) {
  return [
    `schema_version: ${data.schema_version}`,
    `scanned_at: ${data.scanned_at}`,
    `ttl_seconds: ${data.ttl_seconds}`,
    'fingerprint:',
    `  package_json_hash: ${yamlScalar(data.fingerprint.package_json_hash)}`,
    `  lockfile_hash: ${yamlScalar(data.fingerprint.lockfile_hash)}`,
    `  go_mod_hash: ${yamlScalar(data.fingerprint.go_mod_hash)}`,
    `  pyproject_hash: ${yamlScalar(data.fingerprint.pyproject_hash)}`,
    `  git_remote: ${yamlScalar(data.fingerprint.git_remote)}`,
    'project:',
    `  name: ${yamlScalar(data.project.name)}`,
    `  language: ${yamlInlineArray(data.project.language)}`,
    `  framework: ${yamlInlineArray(data.project.framework)}`,
    `  scale: ${yamlScalar(data.project.scale)}`,
    `  loc: ${data.project.loc}`,
    `  module_count: ${data.project.module_count}`,
    `  is_monorepo: ${data.project.is_monorepo}`,
    'byted_signals:',
    `  strong: ${yamlInlineArray(data.byted_signals.strong)}`,
    `  weak: ${yamlInlineArray(data.byted_signals.weak)}`,
    `  is_internal: ${data.byted_signals.is_internal}`,
    'ai_configs:',
    `  has_claude_md: ${data.ai_configs.has_claude_md}`,
    `  has_cursor_rules: ${data.ai_configs.has_cursor_rules}`,
    `  installed_skills: ${yamlInlineArray(data.ai_configs.installed_skills)}`,
    'context_budget:',
    `  xs: ${data.context_budget.xs}`,
    `  s: ${data.context_budget.s}`,
    `  m: ${data.context_budget.m}`,
    `  l: ${data.context_budget.l}`,
    '',
  ].join('\n');
}

function yamlScalar(value) {
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  const text = value == null ? '' : String(value);
  if (text === '') {
    return '""';
  }

  if (/^[A-Za-z0-9._@/:+\-]+$/.test(text)) {
    return text;
  }

  return JSON.stringify(text);
}

function yamlInlineArray(values) {
  if (!Array.isArray(values) || values.length === 0) {
    return '[]';
  }
  return `[${values.map((value) => yamlScalar(value)).join(', ')}]`;
}

function parseProjectYaml(content) {
  const result = {
    fingerprint: {},
    project: { language: [], framework: [] },
    byted_signals: { strong: [], weak: [], is_internal: false },
    ai_configs: { installed_skills: [] },
    context_budget: {},
  };

  let section = '';
  const lines = content.split(/\r?\n/);
  for (const rawLine of lines) {
    const line = rawLine.replace(/\t/g, '    ');
    if (!line.trim()) {
      continue;
    }

    if (!line.startsWith('  ')) {
      const sectionMatch = line.match(/^([a-z_]+):\s*$/i);
      if (sectionMatch) {
        section = sectionMatch[1];
        continue;
      }

      const pair = line.match(/^([a-z_]+):\s*(.+)$/i);
      if (pair) {
        result[pair[1]] = parseYamlValue(pair[2]);
      }
      continue;
    }

    const trimmed = line.trim();
    const pair = trimmed.match(/^([a-z_]+):\s*(.+)$/i);
    if (!pair || !section) {
      continue;
    }

    if (!result[section] || typeof result[section] !== 'object') {
      result[section] = {};
    }
    result[section][pair[1]] = parseYamlValue(pair[2]);
  }

  return result;
}

function parseYamlValue(value) {
  const trimmed = value.trim();

  if (trimmed === 'true') return true;
  if (trimmed === 'false') return false;
  if (trimmed === '[]') return [];
  if (/^-?\d+$/.test(trimmed)) return Number(trimmed);
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    try {
      return JSON.parse(trimmed.replace(/^'/, '"').replace(/'$/, '"'));
    } catch (error) {
      return trimmed.slice(1, -1);
    }
  }
  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    const inner = trimmed.slice(1, -1).trim();
    if (!inner) return [];
    return inner.split(',').map((item) => parseYamlValue(item.trim()));
  }

  return trimmed;
}

main();
