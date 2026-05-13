#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const childProcess = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const PACKAGE_JSON_PATH = path.join(ROOT, 'package.json');
const CHANGELOG_PATH = path.join(ROOT, 'CHANGELOG.md');

function main() {
  const packageJson = JSON.parse(fs.readFileSync(PACKAGE_JSON_PATH, 'utf8'));
  const changelog = fs.readFileSync(CHANGELOG_PATH, 'utf8');
  const version = packageJson.version;

  if (!hasUnreleasedEntries(changelog)) {
    console.warn('[check-changelog] warning: [Unreleased] section is empty.');
  }

  const versionChanged = hasVersionChanged(version);
  const versionSectionExists = changelog.includes(`## [${version}]`);

  if (versionChanged && !versionSectionExists) {
    console.error(`[check-changelog] version ${version} changed, but CHANGELOG.md is missing section ## [${version}].`);
    process.exitCode = 1;
    return;
  }

  console.log('[check-changelog] ok');
}

function hasUnreleasedEntries(changelog) {
  const match = changelog.match(/## \[Unreleased\]([\s\S]*?)(?:\n## \[|$)/);
  if (!match) {
    return false;
  }

  return /-\s+\S/.test(match[1]);
}

function hasVersionChanged(version) {
  const tagName = resolveLatestTag();
  if (!tagName) {
    return false;
  }

  const diffOutput = runGit(`diff ${tagName} -- package.json`);
  if (!diffOutput) {
    return false;
  }

  return diffOutput.includes(`+  "version": "${version}"`) || diffOutput.includes(`-  "version": "${version}"`);
}

function resolveLatestTag() {
  const output = runGit('tag --sort=-creatordate');
  if (!output) {
    return '';
  }

  return output.split(/\r?\n/).map((line) => line.trim()).find(Boolean) || '';
}

function runGit(args) {
  try {
    return childProcess.execSync(`git ${args}`, {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch (error) {
    return '';
  }
}

main();
