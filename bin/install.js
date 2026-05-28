#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const os = require('os');
const readline = require('readline');
const childProcess = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const SKILLS_SOURCE = path.join(ROOT, 'skills');
const TEMPLATES_SOURCE = path.join(ROOT, 'templates');

const HOST_LAYOUTS = {
  claude: {
    label: 'Claude Code',
    globalSkillsDir: path.join(os.homedir(), '.claude', 'skills'),
    projectSkillsDir: '.claude/skills',
    projectRulesFile: 'CLAUDE.md',
  },
  trae: {
    label: 'Trae CLI',
    globalSkillsDir: path.join(os.homedir(), '.trae', 'skills'),
    projectSkillsDir: '.trae/skills',
    projectRulesFile: 'AGENTS.md',
  },
  codex: {
    label: 'Codex CLI',
    globalSkillsDir: path.join(os.homedir(), '.codex', 'skills'),
    projectSkillsDir: '.codex/skills',
    projectRulesFile: 'AGENTS.md',
  },
};

function printHelp() {
  console.log(`ai-devkit installer

Usage:
  node bin/install.js [options]
  node bin/detect.js [--refresh]
  ai-devkit [options]
  ai-devkit-detect [--refresh]

Options:
  --help              Show this help message
  --global            Install into global skills directories for Claude, Trae, and Codex
  --project           Install into current project skills directories for Claude, Trae, and Codex

Verified usage paths:
  - Local development: node bin/install.js [options]
  - Project detection: node bin/detect.js [--refresh]
  - Installed package: ai-devkit [options], ai-devkit-detect [--refresh]
  - Direct npx execution may depend on local registry and auth configuration

What this installer does:
  - Installs devkit-init and devkit-go to all supported hosts (Claude, Trae, Codex)
  - Installs globally or into current project based on selected scope
  - Copies skill docs and templates/ into installed devkit-go directories
  - Writes managed blocks to CLAUDE.md and AGENTS.md for project scope

Host notes:
  - Global scope targets: ~/.claude/skills, ~/.trae/skills, ~/.codex/skills
  - Project scope targets: .claude/skills, .trae/skills, .codex/skills
`);
}

function parseArgs(argv) {
  const args = { help: false, scope: null };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    if (arg === '--help' || arg === '-h') {
      args.help = true;
      continue;
    }

    if (arg === '--global') {
      args.scope = 'global';
      continue;
    }

    if (arg === '--project') {
      args.scope = 'project';
      continue;
    }


    throw new Error(`Unknown argument: ${arg}`);
  }

  if (args.scope === 'global' && argv.includes('--project')) {
    throw new Error('Use only one of --global or --project');
  }

  return args;
}

function resolveTargets(scope, projectRoot) {
  return Object.entries(HOST_LAYOUTS).map(([host, layout]) => ({
    host,
    label: layout.label,
    skillsDir: scope === 'global' ? layout.globalSkillsDir : path.join(projectRoot, layout.projectSkillsDir),
    projectRulesFile: scope === 'project' ? layout.projectRulesFile : null,
  }));
}

function createInterface() {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
}

function askQuestion(rl, prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, (answer) => resolve(answer.trim()));
  });
}

async function chooseScope(explicitScope) {
  if (explicitScope) {
    return explicitScope;
  }

  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    return 'project';
  }

  const rl = createInterface();

  try {
    while (true) {
      const answer = (await askQuestion(
        rl,
        'Select install scope: [1] Global [2] Project > '
      )).toLowerCase();

      if (answer === '1' || answer === 'global' || answer === 'g') {
        return 'global';
      }

      if (answer === '2' || answer === 'project' || answer === 'p') {
        return 'project';
      }

      console.log('Please choose 1 for global or 2 for project.');
    }
  } finally {
    rl.close();
  }
}

function ensureDirectory(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function copyFile(sourcePath, targetPath) {
  ensureDirectory(path.dirname(targetPath));
  fs.copyFileSync(sourcePath, targetPath);
}

function copyDirectory(sourceDir, targetDir, copied = []) {
  ensureDirectory(targetDir);
  const entries = fs.readdirSync(sourceDir, { withFileTypes: true });

  for (const entry of entries) {
    const sourcePath = path.join(sourceDir, entry.name);
    const targetPath = path.join(targetDir, entry.name);

    if (entry.isDirectory()) {
      copyDirectory(sourcePath, targetPath, copied);
      continue;
    }

    copyFile(sourcePath, targetPath);
    copied.push(targetPath);
  }

  return copied;
}

function installSkill(skillName, targetSkillsDir, copiedFiles) {
  const sourceDir = path.join(SKILLS_SOURCE, skillName);
  const targetDir = path.join(targetSkillsDir, skillName);

  copyDirectory(sourceDir, targetDir, copiedFiles);

  if (skillName === 'devkit-go') {
    const targetTemplatesDir = path.join(targetDir, 'templates');
    copyDirectory(TEMPLATES_SOURCE, targetTemplatesDir, copiedFiles);
  }
}

function recordInstalledSkills(projectRoot, skillNames) {
  if (!skillNames.length) {
    return;
  }

  childProcess.execFileSync(process.execPath, [path.join(__dirname, 'detect.js'), 'record-install', ...skillNames], {
    cwd: projectRoot,
    stdio: 'pipe',
  });
}

const MANAGED_START_RE = /<!--\s*devkit-managed:start\s+version=\d+\s+generated_at=[^\s>]+\s*-->/;
const MANAGED_END_RE = /<!--\s*devkit-managed:end\s*-->/;

function writeManagedBlockForProject(projectRoot, skillNames, rulesFile) {
  const rulesPath = path.join(projectRoot, rulesFile);
  const blockContent = renderManagedBlock(skillNames);

  if (!fs.existsSync(rulesPath)) {
    if (rulesFile === 'CLAUDE.md') {
      const templatePath = path.join(ROOT, 'templates', 'CLAUDE.md');
      if (fs.existsSync(templatePath)) {
        const template = fs.readFileSync(templatePath, 'utf8');
        const filled = template
          .replace('<ISO8601>', new Date().toISOString())
          .replace('<!-- 此处由 install.js 按 project.yaml.ai_configs.installed_skills 动态填充 -->\n- devkit-init: project bootstrap, audit, adopt\n- devkit-go: 7-stage development workflow', blockContent.trim());
        fs.writeFileSync(rulesPath, filled, 'utf8');
      }
    } else {
      const content = `# ${rulesFile}\n\n<!-- devkit-managed:start version=1 generated_at=${new Date().toISOString()} -->\n${blockContent}<!-- devkit-managed:end -->\n`;
      fs.writeFileSync(rulesPath, content, 'utf8');
    }
    return;
  }

  const existing = fs.readFileSync(rulesPath, 'utf8');
  const startMatch = existing.match(MANAGED_START_RE);
  const endMatch = existing.match(MANAGED_END_RE);

  if (startMatch && endMatch) {
    const startIdx = existing.indexOf(startMatch[0]);
    const endIdx = existing.indexOf(endMatch[0]);

    if (endIdx < startIdx) {
      const startLine = existing.split(/\r?\n/).findIndex((l) => MANAGED_START_RE.test(l)) + 1;
      throw new Error(`Managed block markers out of order: start at line ${startLine}, end appears before start. Refusing to modify.`);
    }

    const before = existing.slice(0, startIdx);
    const after = existing.slice(endIdx + endMatch[0].length);
    const newBlock = `<!-- devkit-managed:start version=1 generated_at=${new Date().toISOString()} -->\n${blockContent}<!-- devkit-managed:end -->`;
    fs.writeFileSync(rulesPath, `${before}${newBlock}${after}`, 'utf8');
    return;
  }

  if (startMatch && !endMatch) {
    const startLine = existing.split(/\r?\n/).findIndex((l) => MANAGED_START_RE.test(l)) + 1;
    throw new Error(`Unclosed managed block at line ${startLine}. Missing <!-- devkit-managed:end -->. Refusing to modify.`);
  }

  if (!startMatch && endMatch) {
    const endLine = existing.split(/\r?\n/).findIndex((l) => MANAGED_END_RE.test(l)) + 1;
    throw new Error(`Stray managed block end marker at line ${endLine}. Missing <!-- devkit-managed:start -->. Refusing to modify.`);
  }

  const appended = `${existing.trimEnd()}\n\n<!-- devkit-managed:start version=1 generated_at=${new Date().toISOString()} -->\n${blockContent}<!-- devkit-managed:end -->\n`;
  fs.writeFileSync(rulesPath, appended, 'utf8');
}

function renderManagedBlock(skillNames) {
  const lines = [];

  lines.push('## DevKit Configuration');
  lines.push('');
  lines.push('This section is managed by `devkit-init`. Do not edit manually.');
  lines.push('');
  lines.push('### Installed Skills');
  for (const name of skillNames) {
    if (name === 'devkit-init') {
      lines.push('- devkit-init: project bootstrap, audit, adopt');
    } else if (name === 'devkit-go') {
      lines.push('- devkit-go: 7-stage development workflow');
    } else {
      lines.push(`- ${name}`);
    }
  }
  lines.push('');

  const yamlPath = path.join(process.cwd(), '.devkit', 'project.yaml');
  if (fs.existsSync(yamlPath)) {
    const yamlContent = fs.readFileSync(yamlPath, 'utf8');
    const parsed = parseSimpleYaml(yamlContent);

    lines.push('### Project Meta');
    const lang = parsed.language || 'unknown';
    const scale = parsed.scale || 'XS';
    const internal = parsed.is_internal ? 'true' : 'false';
    lines.push(`- language: ${lang}`);
    lines.push(`- scale: ${scale}`);
    lines.push(`- internal: ${internal}`);
    lines.push('');
  }

  lines.push('### Workflow Conventions');
  lines.push('- 触发 devkit-go 进入 7 阶段流程');
  lines.push('- _meta.yaml schema_version: 2');
  lines.push('- STATE.md 字段顺序锁定(详见 templates/STATE.md)');

  return `${lines.join('\n')}\n`;
}

function parseSimpleYaml(content) {
  const result = {};
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const index = line.indexOf(':');
    if (index === -1) continue;
    const key = line.slice(0, index).trim();
    const rawValue = line.slice(index + 1).trim();
    if (rawValue === '[]') {
      result[key] = [];
    } else if (/^-?\d+$/.test(rawValue)) {
      result[key] = Number(rawValue);
    } else if ((rawValue.startsWith('"') && rawValue.endsWith('"')) || (rawValue.startsWith("'") && rawValue.endsWith("'"))) {
      result[key] = rawValue.slice(1, -1);
    } else {
      result[key] = rawValue;
    }
  }
  return result;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    printHelp();
    return;
  }

  const scope = await chooseScope(args.scope);
  const projectRoot = process.cwd();
  const targets = resolveTargets(scope, projectRoot);

  const copiedFiles = [];
  const installedSkillNames = ['devkit-init', 'devkit-go'];

  for (const target of targets) {
    ensureDirectory(target.skillsDir);
    installSkill('devkit-init', target.skillsDir, copiedFiles);
    installSkill('devkit-go', target.skillsDir, copiedFiles);
  }

  if (scope === 'project') {
    recordInstalledSkills(projectRoot, installedSkillNames);
    writeManagedBlockForProject(projectRoot, installedSkillNames, 'CLAUDE.md');
    writeManagedBlockForProject(projectRoot, installedSkillNames, 'AGENTS.md');
  }

  console.log('ai-devkit installation complete.');
  console.log(`Scope: ${scope}`);
  console.log('Host targets:');
  for (const target of targets) {
    console.log(`- ${target.label}: ${target.skillsDir}`);
  }
  console.log('Copied files:');
  for (const file of copiedFiles) {
    console.log(`- ${file}`);
  }
}

main().catch((error) => {
  console.error(`Installation failed: ${error.message}`);
  process.exitCode = 1;
});
