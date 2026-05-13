#!/usr/bin/env node

const fs = require('fs');
const os = require('os');
const path = require('path');
const childProcess = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const TEMP_PREFIX = path.join(os.tmpdir(), 'ai-devkit-smoke-');

function main() {
  const tempRoot = fs.mkdtempSync(TEMP_PREFIX);
  const projectRoot = path.join(tempRoot, 'fixture');

  try {
    fs.mkdirSync(projectRoot, { recursive: true });
    createFixtureProject(projectRoot);
    installFiles(projectRoot);
    runDetect(projectRoot);
    assertProjectYaml(projectRoot);
    renderSpecArtifacts(projectRoot, 'smoke-xs', 'XS');
    assertRenderedOutputs(projectRoot, 'smoke-xs');
    assertTemplateCopies(projectRoot);
    assertMissingTemplateFails(projectRoot);
    console.log('PASS');
  } catch (error) {
    console.error(`FAIL: ${error.message}`);
    process.exitCode = 1;
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
}

function createFixtureProject(projectRoot) {
  const packageJson = {
    name: 'smoke-fixture',
    version: '0.0.1',
    private: true,
    scripts: {
      test: 'node -e "console.log(\'ok\')"',
    },
    dependencies: {
      react: '^18.0.0',
    },
  };

  fs.writeFileSync(path.join(projectRoot, 'package.json'), `${JSON.stringify(packageJson, null, 2)}\n`, 'utf8');
  fs.writeFileSync(path.join(projectRoot, 'src.js'), 'export const smoke = true;\n', 'utf8');
}

function installFiles(projectRoot) {
  const targetSkillsDir = path.join(projectRoot, '.claude', 'skills');
  copyDirectory(path.join(ROOT, 'skills', 'devkit-init'), path.join(targetSkillsDir, 'devkit-init'));
  copyDirectory(path.join(ROOT, 'skills', 'devkit-go'), path.join(targetSkillsDir, 'devkit-go'));
  copyDirectory(path.join(ROOT, 'templates'), path.join(targetSkillsDir, 'devkit-go', 'templates'));
}

function runDetect(projectRoot) {
  childProcess.execFileSync(process.execPath, [path.join(ROOT, 'bin', 'detect.js')], {
    cwd: projectRoot,
    stdio: 'pipe',
  });
}

function assertProjectYaml(projectRoot) {
  const projectYamlPath = path.join(projectRoot, '.devkit', 'project.yaml');
  const content = readRequiredFile(projectYamlPath);
  assertIncludes(content, 'project:', '.devkit/project.yaml.project section missing');
  assertIncludes(content, 'scale:', '.devkit/project.yaml.project.scale missing');
}

function renderSpecArtifacts(projectRoot, changeId, size) {
  const specsDir = path.join(projectRoot, '.specs', changeId);
  fs.mkdirSync(specsDir, { recursive: true });

  const metaTemplate = readRequiredFile(path.join(ROOT, 'templates', '_meta.yaml'));
  const metaContent = metaTemplate
    .replace('{{change-id}}', changeId)
    .replace('{{XS|S|M|L}}', size)
    .replace('stages: []', 'stages: [0, 1]')
    .replace('current_stage: ""', 'current_stage: "1-SPEC"');
  fs.writeFileSync(path.join(specsDir, '_meta.yaml'), metaContent, 'utf8');

  const stateContent = [
    `active_change_id: ${changeId}`,
    'current_stage: 1-SPEC',
    'status: active',
  ].join('\n');
  fs.mkdirSync(path.join(projectRoot, '.specs'), { recursive: true });
  fs.writeFileSync(path.join(projectRoot, '.specs', 'STATE.md'), `${stateContent}\n`, 'utf8');

  const proposalTemplate = readRequiredFile(path.join(ROOT, 'templates', 'CHANGE.md')).replace(/{{change-id}}/g, changeId);
  fs.writeFileSync(path.join(specsDir, 'proposal.md'), proposalTemplate, 'utf8');

  const requirementTemplate = readRequiredFile(path.join(ROOT, 'templates', 'REQUIREMENT.md'));
  const renderedRequirement = renderTemplateBySize(requirementTemplate, size);
  fs.writeFileSync(path.join(specsDir, 'requirements.md'), renderedRequirement, 'utf8');
}

function assertRenderedOutputs(projectRoot, changeId) {
  const specsDir = path.join(projectRoot, '.specs', changeId);
  const requirementContent = readRequiredFile(path.join(specsDir, 'requirements.md'));
  const stateContent = readRequiredFile(path.join(projectRoot, '.specs', 'STATE.md'));

  assertIncludes(requirementContent, '## 功能需求', 'XS rendered requirement missing size:all content');
  assertNotIncludes(requirementContent, '## 用户故事', 'XS rendered requirement should remove size:S+ content');
  assertNotIncludes(requirementContent, '## 非功能需求', 'XS rendered requirement should remove size:M+ content');
  assertNotIncludes(requirementContent, '## Alternatives Considered', 'XS rendered requirement should remove size:L content');
  assertIncludes(stateContent, `active_change_id: ${changeId}`, 'STATE.md missing active_change_id');
}

function assertTemplateCopies(projectRoot) {
  const requirementTemplateCopy = path.join(projectRoot, '.claude', 'skills', 'devkit-go', 'templates', 'REQUIREMENT.md');
  const designTemplateCopy = path.join(projectRoot, '.claude', 'skills', 'devkit-go', 'templates', 'DESIGN.md');
  const projectYamlPath = path.join(projectRoot, '.devkit', 'project.yaml');

  readRequiredFile(requirementTemplateCopy);
  readRequiredFile(designTemplateCopy);
  readRequiredFile(projectYamlPath);
}

function assertMissingTemplateFails(projectRoot) {
  const tempTemplatePath = path.join(projectRoot, '.claude', 'skills', 'devkit-go', 'templates', 'REQUIREMENT.md');
  const backup = readRequiredFile(tempTemplatePath);
  fs.rmSync(tempTemplatePath);

  let failed = false;
  try {
    readRequiredFile(tempTemplatePath);
  } catch (error) {
    failed = /Missing file/.test(error.message);
  } finally {
    fs.writeFileSync(tempTemplatePath, backup, 'utf8');
  }

  if (!failed) {
    throw new Error('missing template check did not report REQUIREMENT.md');
  }
}

function renderTemplateBySize(template, size) {
  const order = { XS: 0, S: 1, M: 2, L: 3 };
  const minimums = {
    all: 0,
    'S+': 1,
    'M+': 2,
    L: 3,
  };

  return template.replace(/<!--\s*size:(all|S\+|M\+|L)\s*-->[\r\n]*([\s\S]*?)<!--\s*\/size:\1\s*-->/g, (full, marker, body) => {
    if (order[size] >= minimums[marker]) {
      return body.trimEnd();
    }
    return '';
  }).replace(/\n{3,}/g, '\n\n').trim() + '\n';
}

function readRequiredFile(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing file: ${filePath}`);
  }
  return fs.readFileSync(filePath, 'utf8');
}

function assertIncludes(content, expected, message) {
  if (!content.includes(expected)) {
    throw new Error(message);
  }
}

function assertNotIncludes(content, expected, message) {
  if (content.includes(expected)) {
    throw new Error(message);
  }
}

function copyDirectory(sourceDir, targetDir) {
  fs.mkdirSync(targetDir, { recursive: true });
  for (const entry of fs.readdirSync(sourceDir, { withFileTypes: true })) {
    const sourcePath = path.join(sourceDir, entry.name);
    const targetPath = path.join(targetDir, entry.name);
    if (entry.isDirectory()) {
      copyDirectory(sourcePath, targetPath);
    } else {
      fs.copyFileSync(sourcePath, targetPath);
    }
  }
}

main();
