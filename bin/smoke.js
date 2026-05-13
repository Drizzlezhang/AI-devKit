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
    assertVerificationTemplate(projectRoot, 'XS');
    assertMetaSchemaUpgrade(projectRoot);
    assertTemplateCopies(projectRoot);
    assertRenderCli(projectRoot);
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
    .replace('current_stage: ""', 'current_stage: "1-SPEC"')
    .replace('last_tldr: ""', 'last_tldr: "Draft requirement skeleton"')
    .replace('last_next: ""', 'last_next: "Finish requirements.md"')
    .replace('last_risk: ""', 'last_risk: "Scope may expand"')
    .replace('last_progress_note: ""', 'last_progress_note: "proposal converted to spec outline"');
  fs.writeFileSync(path.join(specsDir, '_meta.yaml'), metaContent, 'utf8');

  const stateTemplate = readRequiredFile(path.join(ROOT, 'templates', 'STATE.md'));
  const stateContent = stateTemplate
    .replace('<id>', changeId)
    .replace('<XS|S|M|L>', size)
    .replace('<0-CHANGE|1-SPEC|2-DESIGN|3-PLAN|4-BUILD|5-VERIFY|5-LITE|6-SHIP>', '1-SPEC')
    .replace('<in_progress|blocked|partial_pass|completed|abandoned>', 'in_progress')
    .replace('<ISO8601>', '2026-05-13T12:00:00+08:00')
    .replace('<一行描述下一步必须做什么,新会话恢复时优先读这一行>', 'Draft requirements.md from proposal.md')
    .replace('- [ ] <未决问题 1,带阻塞标签>', '- [ ] none')
    .replace('- <当前已识别风险,2-5 行>', '- scope drift')
    .replace('<自由形式,模型可写任意上下文备忘>', 'smoke notes');
  fs.writeFileSync(path.join(specsDir, 'STATE.md'), stateContent, 'utf8');

  const rootStateContent = [
    `active_change_id: ${changeId}`,
    'current_stage: 1-SPEC',
    'status: active',
  ].join('\n');
  fs.mkdirSync(path.join(projectRoot, '.specs'), { recursive: true });
  fs.writeFileSync(path.join(projectRoot, '.specs', 'STATE.md'), `${rootStateContent}\n`, 'utf8');

  const proposalTemplate = readRequiredFile(path.join(ROOT, 'templates', 'CHANGE.md')).replace(/{{change-id}}/g, changeId);
  fs.writeFileSync(path.join(specsDir, 'proposal.md'), proposalTemplate, 'utf8');

  const requirementTemplatePath = path.join(ROOT, 'templates', 'REQUIREMENT.md');
  const renderedRequirement = childProcess.execFileSync(process.execPath, [path.join(ROOT, 'bin', 'render-template.js'), requirementTemplatePath, '--size', size], {
    cwd: projectRoot,
    stdio: 'pipe',
    encoding: 'utf8',
  });
  fs.writeFileSync(path.join(specsDir, 'requirements.md'), renderedRequirement, 'utf8');
}

function assertRenderedOutputs(projectRoot, changeId) {
  const specsDir = path.join(projectRoot, '.specs', changeId);
  const requirementContent = readRequiredFile(path.join(specsDir, 'requirements.md'));
  const rootStateContent = readRequiredFile(path.join(projectRoot, '.specs', 'STATE.md'));
  const changeStateContent = readRequiredFile(path.join(specsDir, 'STATE.md'));
  const metaContent = readRequiredFile(path.join(specsDir, '_meta.yaml'));

  assertIncludes(requirementContent, '## 功能需求', 'XS rendered requirement missing size:all content');
  assertIncludes(requirementContent, '## 验收标准与验证方式', 'XS rendered requirement missing AC verification section');
  assertIncludes(requirementContent, '| AC | 验证方式 |', 'XS rendered requirement missing AC verification table');
  assertNotIncludes(requirementContent, '## 用户故事', 'XS rendered requirement should remove size:S+ content');
  assertNotIncludes(requirementContent, '## 非功能需求', 'XS rendered requirement should remove size:M+ content');
  assertNotIncludes(requirementContent, '## Alternatives Considered', 'XS rendered requirement should remove size:L content');
  assertNotIncludes(requirementContent, '<!-- size:', 'rendered requirement should not contain HTML markers');
  assertIncludes(rootStateContent, `active_change_id: ${changeId}`, 'root STATE.md missing active_change_id');
  assertStateSchema(changeStateContent);
  assertMetaSchema(changeId, metaContent);
}

function assertVerificationTemplate(projectRoot, size) {
  const verificationTemplatePath = path.join(ROOT, 'templates', 'VERIFICATION.md');
  const renderedVerification = childProcess.execFileSync(process.execPath, [path.join(ROOT, 'bin', 'render-template.js'), verificationTemplatePath, '--size', size], {
    cwd: projectRoot,
    stdio: 'pipe',
    encoding: 'utf8',
  });

  assertIncludes(renderedVerification, '## AC 对账', 'rendered verification missing AC reconciliation section');
  assertIncludes(renderedVerification, '验收标准与验证方式', 'rendered verification should reference requirement AC verification table');
  assertIncludes(renderedVerification, '| AC | 验证方式 | 状态 | 证据 |', 'rendered verification missing AC reconciliation table');
  assertNotIncludes(renderedVerification, '<!-- size:', 'rendered verification should not contain HTML markers');
}

function assertMetaSchema(changeId, content) {
  assertIncludes(content, 'schema_version: 2', '_meta.yaml missing schema_version 2');
  assertIncludes(content, `change_id: "${changeId}"`, '_meta.yaml missing change_id');
  assertIncludes(content, 'last_tldr: "Draft requirement skeleton"', '_meta.yaml missing last_tldr');
  assertIncludes(content, 'last_next: "Finish requirements.md"', '_meta.yaml missing last_next');
  assertIncludes(content, 'last_risk: "Scope may expand"', '_meta.yaml missing last_risk');
  assertIncludes(content, 'last_progress_note: "proposal converted to spec outline"', '_meta.yaml missing last_progress_note');
  assertIncludes(content, 'last_context_mode: "full"', '_meta.yaml missing last_context_mode');
}

function assertMetaSchemaUpgrade(projectRoot) {
  const legacyMeta = [
    'schema_version: 1',
    'change_id: "legacy-change"',
    'size: "S"',
    'stages: [0, 1]',
    'current_stage: "4-BUILD"',
    'status: "active"',
    'created_at: ""',
    'updated_at: ""',
    'retry_count: 1',
    'last_verified_at: ""',
    'last_context_mode: "resume-minimal"',
    '',
  ].join('\n');

  const parsed = parseSimpleYaml(legacyMeta);
  const upgraded = ensureMetaSchemaDefaults(parsed);

  if (upgraded.schema_version !== 2) {
    throw new Error('legacy _meta.yaml was not upgraded to schema_version 2');
  }

  ['last_tldr', 'last_next', 'last_risk', 'last_progress_note'].forEach((key) => {
    if (upgraded[key] !== '') {
      throw new Error(`legacy _meta.yaml should default ${key} to empty string`);
    }
  });
}

function ensureMetaSchemaDefaults(meta) {
  return {
    schema_version: Number(meta.schema_version || 1) >= 2 ? Number(meta.schema_version) : 2,
    change_id: meta.change_id || '',
    size: meta.size || '',
    stages: meta.stages || [],
    current_stage: meta.current_stage || '',
    status: meta.status || '',
    created_at: meta.created_at || '',
    updated_at: meta.updated_at || '',
    retry_count: Number(meta.retry_count || 0),
    last_tldr: meta.last_tldr || '',
    last_next: meta.last_next || '',
    last_risk: meta.last_risk || '',
    last_progress_note: meta.last_progress_note || '',
    last_context_mode: meta.last_context_mode || 'full',
    last_verified_at: meta.last_verified_at || '',
  };
}

function parseSimpleYaml(content) {
  const result = {};
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) {
      continue;
    }
    const index = line.indexOf(':');
    if (index === -1) {
      continue;
    }
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

function assertStateSchema(content) {
  const requiredSections = [
    '# State',
    '## Current',
    '## Next Action',
    '## Open Questions',
    '## Risks',
    '## Recent Changes',
    '## Notes',
  ];

  let lastIndex = -1;
  for (const section of requiredSections) {
    const index = content.indexOf(section);
    if (index === -1) {
      throw new Error(`change STATE.md missing section: ${section}`);
    }
    if (index < lastIndex) {
      throw new Error(`change STATE.md section order mismatch: ${section}`);
    }
    lastIndex = index;
  }

  assertIncludes(content, '- **change_id**: smoke-xs', 'change STATE.md missing change_id');
  assertIncludes(content, '- **size**: XS', 'change STATE.md missing size');
  assertIncludes(content, '- **current_stage**: 1-SPEC', 'change STATE.md missing current_stage');
  assertIncludes(content, '## Recent Changes', 'change STATE.md missing Recent Changes');
}

function assertTemplateCopies(projectRoot) {
  const requirementTemplateCopy = path.join(projectRoot, '.claude', 'skills', 'devkit-go', 'templates', 'REQUIREMENT.md');
  const designTemplateCopy = path.join(projectRoot, '.claude', 'skills', 'devkit-go', 'templates', 'DESIGN.md');
  const stateTemplateCopy = path.join(projectRoot, '.claude', 'skills', 'devkit-go', 'templates', 'STATE.md');
  const metaTemplateCopy = path.join(projectRoot, '.claude', 'skills', 'devkit-go', 'templates', '_meta.yaml');
  const verificationTemplateCopy = path.join(projectRoot, '.claude', 'skills', 'devkit-go', 'templates', 'VERIFICATION.md');
  const projectYamlPath = path.join(projectRoot, '.devkit', 'project.yaml');

  readRequiredFile(requirementTemplateCopy);
  readRequiredFile(designTemplateCopy);
  readRequiredFile(stateTemplateCopy);
  readRequiredFile(metaTemplateCopy);
  readRequiredFile(verificationTemplateCopy);
  readRequiredFile(projectYamlPath);
}

function assertRenderCli(projectRoot) {
  const requirementTemplatePath = path.join(ROOT, 'templates', 'REQUIREMENT.md');
  const renderedL = childProcess.execFileSync(process.execPath, [path.join(ROOT, 'bin', 'render-template.js'), requirementTemplatePath, '--size', 'L'], {
    cwd: projectRoot,
    stdio: 'pipe',
    encoding: 'utf8',
  });
  assertIncludes(renderedL, '## Alternatives Considered', 'L render should keep size:L content');
  assertNotIncludes(renderedL, '<!-- size:', 'render CLI output should not keep HTML markers');

  const brokenTemplatePath = path.join(projectRoot, 'broken-template.md');
  fs.writeFileSync(brokenTemplatePath, '<!-- size:all -->\nhello\n', 'utf8');

  let failed = false;
  try {
    childProcess.execFileSync(process.execPath, [path.join(ROOT, 'bin', 'render-template.js'), brokenTemplatePath, '--size', 'XS'], {
      cwd: projectRoot,
      stdio: 'pipe',
      encoding: 'utf8',
    });
  } catch (error) {
    failed = /Unclosed size marker/.test(String(error.stderr || error.message));
  }

  if (!failed) {
    throw new Error('render-template CLI should fail on unclosed size markers');
  }
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
