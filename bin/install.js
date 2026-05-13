#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const os = require('os');
const readline = require('readline');

const ROOT = path.resolve(__dirname, '..');
const SKILLS_SOURCE = path.join(ROOT, 'skills');
const TEMPLATES_SOURCE = path.join(ROOT, 'templates');

const RUNTIMES = {
  claude: {
    label: 'Claude Code',
    configDir: path.join(os.homedir(), '.claude'),
    globalSkillsDir: path.join(os.homedir(), '.claude', 'skills'),
    supportsSkillInstall: true,
  },
  trae: {
    label: 'Trae CLI',
    configDir: path.join(os.homedir(), '.trae'),
    globalSkillsDir: null,
    supportsSkillInstall: false,
  },
  codex: {
    label: 'Codex CLI',
    configDir: path.join(os.homedir(), '.codex'),
    globalSkillsDir: null,
    supportsSkillInstall: false,
  },
};

function printHelp() {
  console.log(`ai-devkit installer

Usage:
  node bin/install.js [options]
  ai-devkit [options]

Options:
  --help              Show this help message
  --global            Install into the verified global skills directory for the selected runtime
  --project           Install into the current project's .claude/skills directory
  --runtime <name>    Force runtime: claude | trae | codex

Verified usage paths:
  - Local development: node bin/install.js [options]
  - Installed package: ai-devkit [options]
  - Direct npx execution may depend on local registry and auth configuration

What this installer does:
  - Detects Claude Code, Trae CLI, or Codex CLI from local config directories
  - Asks whether to install globally or into the current project
  - Copies devkit-init and devkit-go skills, including their docs, into the target skills directory
  - Copies templates/ into the installed devkit-go skill directory

Runtime notes:
  - Claude Code uses ~/.claude/skills for global skill installation
  - Codex CLI is detected via ~/.codex/config.toml and project .codex/config.toml, but Claude-style global skill installation is not defined here
  - Trae CLI is detected via ~/.trae, but its official global skill directory is not asserted by this installer
`);
}

function parseArgs(argv) {
  const args = { help: false, scope: null, runtime: null };

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

    if (arg === '--runtime') {
      const value = argv[i + 1];
      if (!value) {
        throw new Error('Missing value for --runtime');
      }
      args.runtime = value.toLowerCase();
      i += 1;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  if (args.scope === 'global' && argv.includes('--project')) {
    throw new Error('Use only one of --global or --project');
  }

  return args;
}

function detectRuntime(preferredRuntime) {
  if (preferredRuntime) {
    const runtime = RUNTIMES[preferredRuntime];
    if (!runtime) {
      throw new Error(`Unsupported runtime: ${preferredRuntime}`);
    }
    return {
      key: preferredRuntime,
      runtime,
      detected: fs.existsSync(runtime.configDir),
      note: fs.existsSync(runtime.configDir)
        ? `Using forced runtime ${runtime.label}.`
        : `Using forced runtime ${runtime.label}; config directory does not exist yet.`,
    };
  }

  const detected = Object.entries(RUNTIMES)
    .map(([key, runtime]) => ({ key, runtime, exists: fs.existsSync(runtime.configDir) }))
    .filter((entry) => entry.exists);

  if (detected.length === 1) {
    return {
      key: detected[0].key,
      runtime: detected[0].runtime,
      detected: true,
      note: `Detected ${detected[0].runtime.label} from ${detected[0].runtime.configDir}.`,
    };
  }

  if (detected.length > 1) {
    return {
      key: detected[0].key,
      runtime: detected[0].runtime,
      detected: true,
      note: `Detected multiple runtimes (${detected.map((entry) => entry.runtime.label).join(', ')}). Defaulting to ${detected[0].runtime.label}. Use --runtime to override.`,
    };
  }

  return {
    key: 'claude',
    runtime: RUNTIMES.claude,
    detected: false,
    note: 'No known runtime config directory was found. Falling back to Claude-compatible layout.',
  };
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
        'Select install scope: [1] Global (Claude only) [2] Project (./.claude/skills) > '
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

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    printHelp();
    return;
  }

  const runtimeSelection = detectRuntime(args.runtime);
  const scope = await chooseScope(args.scope);

  const targetSkillsDir = scope === 'global'
    ? runtimeSelection.runtime.globalSkillsDir
    : path.join(process.cwd(), '.claude', 'skills');

  if (scope === 'global' && !runtimeSelection.runtime.supportsSkillInstall) {
    throw new Error(
      `${runtimeSelection.runtime.label} does not have a verified Claude-style global skills directory. Use --project, or extend the installer with a runtime-specific integration.`
    );
  }

  ensureDirectory(targetSkillsDir);

  const copiedFiles = [];
  installSkill('devkit-init', targetSkillsDir, copiedFiles);
  installSkill('devkit-go', targetSkillsDir, copiedFiles);

  console.log('ai-devkit installation complete.');
  console.log(`Runtime: ${runtimeSelection.runtime.label}`);
  console.log(`Detection: ${runtimeSelection.note}`);
  console.log(`Scope: ${scope}`);
  console.log(`Target skills directory: ${targetSkillsDir}`);
  console.log('Copied files:');
  for (const file of copiedFiles) {
    console.log(`- ${file}`);
  }
}

main().catch((error) => {
  console.error(`Installation failed: ${error.message}`);
  process.exitCode = 1;
});
