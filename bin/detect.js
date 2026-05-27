#!/usr/bin/env node

const fs = require('fs');
const os = require('os');
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

const VALID_TIERS = new Set(['bootstrap', 'adopt', 'audit', 'silent']);

function resolveRuntimeLayout(rootDir) {
  if (fs.existsSync(path.join(rootDir, '.trae', 'skills'))) {
    return { runtime: 'trae', skillsDir: '.trae/skills', rulesFile: 'AGENTS.md' };
  }

  if (fs.existsSync(path.join(rootDir, '.codex', 'skills')) || fs.existsSync(path.join(rootDir, '.codex', 'config.toml'))) {
    return { runtime: 'codex', skillsDir: '.codex/skills', rulesFile: 'AGENTS.md' };
  }

  return { runtime: 'claude', skillsDir: '.claude/skills', rulesFile: 'CLAUDE.md' };
}

function main() {
  const command = process.argv[2];
  if (command === 'record-install') {
    recordInstalledSkills(process.argv.slice(3));
    return;
  }

  const tier = VALID_TIERS.has(process.env.DEVKIT_INIT_TIER) ? process.env.DEVKIT_INIT_TIER : 'bootstrap';
  const forceRefresh = process.argv.includes('--refresh');
  const existing = readExistingProjectFile(PROJECT_FILE);

  if (tier === 'silent') {
    runSilent(existing);
    return;
  }

  const currentFingerprint = collectFingerprint(process.cwd());

  if (tier === 'audit') {
    runAudit(existing, currentFingerprint);
    return;
  }

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

  const analysis = analyzeProject(process.cwd(), currentFingerprint, existing, tier);
  writeProjectFile(PROJECT_FILE, analysis);

  console.log(`project: ${analysis.project.name}`);
  console.log(`scale: ${analysis.project.scale}`);
  console.log(`languages: ${analysis.project.language.join(', ') || 'unknown'}`);
  console.log(`frameworks: ${analysis.project.framework.join(', ') || 'none'}`);
  console.log(`internal: ${analysis.byted_signals.is_internal ? 'yes' : 'no'}`);
  console.log(`has_readme: ${analysis.project.has_readme}`);

  const seeds = recommendSeeds(process.cwd(), analysis);
  console.log('find_skill_hint: true');
  console.log('find_mcp_hint: true');
  if (seeds.length > 0) {
    console.log('recommended_seeds:');
    for (const seed of seeds) {
      console.log(`  - name: ${seed.name}`);
      console.log(`    description: ${seed.description}`);
      console.log(`    install: ${seed.install || seed.source}`);
      console.log(`    stars: ${seed.stars || 0}`);
      if (seed.type === 'mcp') {
        console.log(`    type: mcp`);
        console.log(`    requires_auth: ${seed.requires_auth || false}`);
        console.log(`    mcp_scope: ${(seed.mcp_config && seed.mcp_config.scope) || 'project'}`);
      }
    }
  } else {
    console.log('recommended_seeds: []');
    console.log('hint: use find-skill / find-mcp to discover more');
  }
}

const SCALE_ORDER = { XS: 0, S: 1, M: 2, L: 3, XL: 4 };

function recommendSeeds(rootDir, projectMeta) {
  const seedsPath = path.join(path.dirname(__dirname), 'skills', 'devkit-init', 'seeds.yaml');
  if (!fs.existsSync(seedsPath)) {
    return [];
  }

  let seedsContent;
  try {
    seedsContent = fs.readFileSync(seedsPath, 'utf8');
  } catch (error) {
    return [];
  }

  const seeds = parseSeedsYaml(seedsContent);
  if (!Array.isArray(seeds) || seeds.length === 0) {
    return [];
  }

  const language = projectMeta.project.language || [];
  const scale = projectMeta.project.scale || 'XS';
  const isInternal = !!(projectMeta.byted_signals && projectMeta.byted_signals.is_internal);
  const installedSkills = new Set(
    (projectMeta.ai_configs && Array.isArray(projectMeta.ai_configs.installed_skills))
      ? projectMeta.ai_configs.installed_skills : []
  );

  const matched = seeds.filter((seed) => {
    if (installedSkills.has(seed.name)) {
      return false;
    }

    const when = seed.when || {};
    if (when.language && !language.includes(when.language)) {
      return false;
    }
    if (when.has_file && !fs.existsSync(path.join(rootDir, when.has_file))) {
      return false;
    }
    if (when.has_dir && !fs.existsSync(path.join(rootDir, when.has_dir))) {
      return false;
    }
    if (when.scale_gte) {
      const projectScaleVal = SCALE_ORDER[scale] || 0;
      const requiredScaleVal = SCALE_ORDER[when.scale_gte] || 0;
      if (projectScaleVal < requiredScaleVal) {
        return false;
      }
    }
    if (when.is_internal !== undefined && isInternal !== when.is_internal) {
      return false;
    }

    return true;
  });

  // Sort: seeds with more when conditions first (more specific), then by priority
  matched.sort((a, b) => {
    const aCondCount = Object.keys(a.when || {}).length;
    const bCondCount = Object.keys(b.when || {}).length;
    if (aCondCount !== bCondCount) return bCondCount - aCondCount;
    return (a.priority || 99) - (b.priority || 99);
  });
  return matched.slice(0, 8);
}

function parseSeedsYaml(content) {
  const seeds = [];
  let current = null;
  let block = null; // 'when' | 'mcp_config' | null

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.replace(/\t/g, '    ');
    const indent = line.search(/\S/);

    if (/^\s*-\s+name:/.test(line)) {
      if (current) seeds.push(current);
      const value = line.replace(/^\s*-\s+name:\s*/, '').trim();
      current = { name: unquote(value), when: {}, priority: 99 };
      block = null;
      continue;
    }

    if (!current) continue;

    const pair = line.match(/^\s+(\w+):\s*(.*)$/);
    if (!pair) continue;

    const [, key, rawValue] = pair;
    const value = rawValue.trim();

    if (key === 'when') {
      block = 'when';
      continue;
    }

    if (key === 'mcp_config') {
      block = 'mcp_config';
      current.mcp_config = {};
      continue;
    }

    // Block ends when indent returns to seed level (<=4)
    if (block && indent <= 4) {
      block = null;
    }

    if (block === 'when') {
      current.when[key] = (key === 'is_internal') ? unquote(value) === 'true' : unquote(value);
    } else if (block === 'mcp_config') {
      if (key === 'args' || key === 'env_keys') {
        current.mcp_config[key] = parseInlineArray(value);
      } else {
        current.mcp_config[key] = unquote(value);
      }
    } else if (key === 'description' || key === 'source') {
      current[key] = unquote(value);
    } else if (key === 'install') {
      current[key] = unquote(value);
    } else if (key === 'stars') {
      current[key] = Number(unquote(value)) || 0;
    } else if (key === 'priority') {
      current[key] = Number(unquote(value)) || 99;
    } else if (key === 'type') {
      current[key] = unquote(value);
    } else if (key === 'requires_auth') {
      current[key] = unquote(value) === 'true';
    }
  }

  if (current) seeds.push(current);
  return seeds;
}

function parseInlineArray(value) {
  const trimmed = value.trim();
  if (!trimmed.startsWith('[') || !trimmed.endsWith(']')) return [];
  const inner = trimmed.slice(1, -1).trim();
  if (!inner) return [];
  return inner.split(',').map((item) => {
    const s = item.trim();
    if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
      return s.slice(1, -1);
    }
    return s;
  });
}

function unquote(value) {
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }
  return value;
}

function runSilent(existing) {
  if (!existing) {
    console.log('DevKit: no config found');
    return;
  }

  const name = existing.project.name || path.basename(process.cwd());
  const skillCount = (existing.ai_configs && Array.isArray(existing.ai_configs.installed_skills))
    ? existing.ai_configs.installed_skills.length : 0;
  const scannedAt = existing.scanned_at ? timeAgo(existing.scanned_at) : 'unknown';

  console.log(`DevKit OK · ${skillCount} skill${skillCount !== 1 ? 's' : ''} · scanned ${scannedAt}`);
}

function runAudit(existing, currentFingerprint) {
  if (!existing) {
    console.log('DevKit Audit Report');
    console.log('==================');
    console.log('');
    console.log('No .devkit/project.yaml found. Run bootstrap first.');
    return;
  }

  const name = existing.project.name || path.basename(process.cwd());
  const rootDir = process.cwd();
  const runtimeLayout = resolveRuntimeLayout(rootDir);
  const lines = [];

  lines.push(`DevKit Audit Report — ${new Date().toISOString()}`);
  lines.push('================================');
  lines.push('');
  lines.push('## Project Meta');

  const driftItems = [];

  const fpKeys = ['package_json_hash', 'lockfile_hash', 'go_mod_hash', 'pyproject_hash', 'git_remote'];
  for (const key of fpKeys) {
    const oldVal = existing.fingerprint[key] || '';
    const newVal = currentFingerprint[key] || '';
    if (oldVal !== newVal) {
      driftItems.push(`fingerprint.${key} changed`);
    }
  }

  lines.push(`- name: ${name}`);
  lines.push(`- language: ${(existing.project.language || []).join(', ') || 'unknown'} ${driftItems.length > 0 ? '⚠️ fingerprint drift' : '[unchanged]'}`);
  lines.push(`- scale: ${existing.project.scale || 'XS'}`);
  lines.push(`- internal: ${existing.byted_signals && existing.byted_signals.is_internal ? 'yes' : 'no'}`);
  lines.push(`- runtime_layout: ${runtimeLayout.runtime}`);
  lines.push('');

  // Skill health checks
  const installedSkills = (existing.ai_configs && Array.isArray(existing.ai_configs.installed_skills))
    ? existing.ai_configs.installed_skills : [];
  const highDrift = [];
  const mediumDrift = [];
  const lowDrift = [];

  lines.push(`## Installed Skills (${installedSkills.length})`);
  for (const skill of installedSkills) {
    const skillDir = path.join(rootDir, runtimeLayout.skillsDir, skill);
    const skillMdPath = path.join(skillDir, 'SKILL.md');
    let status = '[up-to-date]';

    if (!fs.existsSync(skillMdPath)) {
      status = '⚠️ SKILL.md missing';
      highDrift.push(`skills/${skill}/SKILL.md missing file`);
    } else {
      const skillContent = fs.readFileSync(skillMdPath, 'utf8');
      if (!/trigger:\s*manual/.test(skillContent)) {
        status = '⚠️ trigger not manual';
        highDrift.push(`skills/${skill}/SKILL.md trigger: manual missing or changed`);
      }
      if (!/^---[\s\S]*?^name:/m.test(skillContent) || !/^---[\s\S]*?^description:/m.test(skillContent)) {
        status = '⚠️ frontmatter incomplete';
        mediumDrift.push(`skills/${skill}/SKILL.md frontmatter missing name or description`);
      }
    }

    lines.push(`- ${skill}  ${status}`);
  }
  lines.push('');

  // Runtime rules file managed block consistency
  const rulesFile = runtimeLayout.rulesFile;
  const rulesPath = path.join(rootDir, rulesFile);
  if (fs.existsSync(rulesPath)) {
    const rulesContent = fs.readFileSync(rulesPath, 'utf8');
    const hasStart = /<!--\s*devkit-managed:start/.test(rulesContent);
    const hasEnd = /<!--\s*devkit-managed:end\s*-->/.test(rulesContent);

    if (hasStart && hasEnd) {
      const blockMatch = rulesContent.match(/<!--\s*devkit-managed:start[\s\S]*?<!--\s*devkit-managed:end\s*-->/);
      if (blockMatch) {
        const block = blockMatch[0];
        for (const skill of installedSkills) {
          if (!block.includes(skill)) {
            mediumDrift.push(`${rulesFile} managed block missing ${skill} section`);
          }
        }
      }
    } else if (hasStart && !hasEnd) {
      highDrift.push(`${rulesFile} managed block unclosed (missing end marker)`);
    } else if (!hasStart && installedSkills.length > 0) {
      mediumDrift.push(`${rulesFile} missing managed block but installed_skills non-empty`);
    }
  }

  if (runtimeLayout.runtime === 'codex' && fs.existsSync(path.join(rootDir, '.claude', 'skills')) && !fs.existsSync(path.join(rootDir, '.codex', 'skills'))) {
    mediumDrift.push('codex legacy layout detected (.claude/skills). migrate to .codex/skills');
  }

  // Fingerprint drift is medium severity
  for (const item of driftItems) {
    mediumDrift.push(item);
  }

  lines.push('## Drift');
  if (highDrift.length === 0 && mediumDrift.length === 0 && lowDrift.length === 0) {
    lines.push('- No drift detected');
  } else {
    if (highDrift.length > 0) {
      lines.push('### 高(必须修复)');
      for (const item of highDrift) {
        lines.push(`- ${item}`);
      }
    }
    if (mediumDrift.length > 0) {
      lines.push('### 中(建议修复)');
      for (const item of mediumDrift) {
        lines.push(`- ${item}`);
      }
    }
    if (lowDrift.length > 0) {
      lines.push('### 低(可选)');
      for (const item of lowDrift) {
        lines.push(`- ${item}`);
      }
    }
  }
  lines.push('');

  lines.push('## Recommendations');
  const recs = [];
  if (highDrift.length > 0) {
    recs.push('1. fix high-severity drift (reinstall skill / restore trigger)');
  }
  if (mediumDrift.length > 0) {
    recs.push(`${recs.length + 1}. sync medium-severity drift (update managed block / rescan)`);
  }
  if (driftItems.length > 0) {
    recs.push(`${recs.length + 1}. rescan to update project.yaml (sync)`);
  }
  if (recs.length === 0) {
    recs.push('1. no action needed');
  }
  for (const rec of recs) {
    lines.push(rec);
  }

  console.log(lines.join('\n'));
}

function timeAgo(isoString) {
  const then = Date.parse(isoString);
  if (Number.isNaN(then)) return 'unknown';
  const diffSec = Math.floor((Date.now() - then) / 1000);
  if (diffSec < 60) return 'just now';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  return `${Math.floor(diffSec / 86400)}d ago`;
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
  const analysis = analyzeProject(process.cwd(), fingerprint, existing, 'bootstrap');
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

function analyzeProject(rootDir, fingerprint, existing, tier) {
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

  const isAdopt = tier === 'adopt';
  const managedBy = isAdopt ? 'user' : 'devkit';
  const runtimeLayout = resolveRuntimeLayout(rootDir);

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
      has_readme: fs.existsSync(path.join(rootDir, 'README.md'))
        || fs.existsSync(path.join(rootDir, 'readme.md'))
        || fs.existsSync(path.join(rootDir, 'Readme.md')),
    },
    byted_signals: bytedSignals,
    ai_configs: {
      has_claude_md: fs.existsSync(path.join(rootDir, 'CLAUDE.md')),
      has_agents_md: fs.existsSync(path.join(rootDir, 'AGENTS.md')),
      has_codex_config: fs.existsSync(path.join(rootDir, '.codex', 'config.toml')) || fs.existsSync(path.join(os.homedir(), '.codex', 'config.toml')),
      has_cursor_rules: fs.existsSync(path.join(rootDir, '.cursorrules')),
      runtime_layout: runtimeLayout.runtime,
      installed_skills: installedSkills,
      managed_by: managedBy,
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
    `  has_readme: ${data.project.has_readme}`,
    'byted_signals:',
    `  strong: ${yamlInlineArray(data.byted_signals.strong)}`,
    `  weak: ${yamlInlineArray(data.byted_signals.weak)}`,
    `  is_internal: ${data.byted_signals.is_internal}`,
    'ai_configs:',
    `  has_claude_md: ${data.ai_configs.has_claude_md}`,
    `  has_agents_md: ${data.ai_configs.has_agents_md || false}`,
    `  has_codex_config: ${data.ai_configs.has_codex_config || false}`,
    `  has_cursor_rules: ${data.ai_configs.has_cursor_rules}`,
    `  runtime_layout: ${yamlScalar(data.ai_configs.runtime_layout || 'claude')}`,
    `  installed_skills: ${yamlInlineArray(data.ai_configs.installed_skills)}`,
    `  managed_by: ${yamlScalar(data.ai_configs.managed_by || 'devkit')}`,
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
