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
    assertDetectTiers(projectRoot);
    assertManagedBlock(projectRoot);
    assertAuditDrift(projectRoot);
    assertSeedRecommend(projectRoot);
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

function assertDetectTiers(projectRoot) {
  const detectPath = path.join(ROOT, 'bin', 'detect.js');
  const env = { ...process.env };

  // bootstrap: default behavior, writes project.yaml
  const bootstrapOut = childProcess.execFileSync(process.execPath, [detectPath], {
    cwd: projectRoot,
    stdio: 'pipe',
    encoding: 'utf8',
    env: { ...env, DEVKIT_INIT_TIER: 'bootstrap' },
  });
  assertIncludes(bootstrapOut, 'project:', 'bootstrap tier should output project info');

  const yamlPath = path.join(projectRoot, '.devkit', 'project.yaml');
  const yamlContent = readRequiredFile(yamlPath);
  assertIncludes(yamlContent, 'managed_by: devkit', 'bootstrap should set managed_by: devkit');

  // silent: reads yaml, outputs one-line summary, no file write
  const yamlMtimeBefore = fs.statSync(yamlPath).mtimeMs;
  const silentOut = childProcess.execFileSync(process.execPath, [detectPath], {
    cwd: projectRoot,
    stdio: 'pipe',
    encoding: 'utf8',
    env: { ...env, DEVKIT_INIT_TIER: 'silent' },
  });
  const yamlMtimeAfter = fs.statSync(yamlPath).mtimeMs;
  assertIncludes(silentOut, 'DevKit OK', 'silent tier should output OK summary');
  if (silentOut.trim().split('\n').length !== 1) {
    throw new Error('silent tier should output single line');
  }
  if (yamlMtimeBefore !== yamlMtimeAfter) {
    throw new Error('silent tier should not write files');
  }

  // audit: outputs drift report, no file write
  const auditOut = childProcess.execFileSync(process.execPath, [detectPath], {
    cwd: projectRoot,
    stdio: 'pipe',
    encoding: 'utf8',
    env: { ...env, DEVKIT_INIT_TIER: 'audit' },
  });
  assertIncludes(auditOut, 'DevKit Audit Report', 'audit tier should output audit report');
  assertIncludes(auditOut, '## Drift', 'audit tier should include Drift section');
  const yamlMtimeAfterAudit = fs.statSync(yamlPath).mtimeMs;
  if (yamlMtimeAfter !== yamlMtimeAfterAudit) {
    throw new Error('audit tier should not write files');
  }

  // adopt: writes yaml with managed_by: user
  childProcess.execFileSync(process.execPath, [detectPath, '--refresh'], {
    cwd: projectRoot,
    stdio: 'pipe',
    encoding: 'utf8',
    env: { ...env, DEVKIT_INIT_TIER: 'adopt' },
  });
  const adoptYamlContent = readRequiredFile(yamlPath);
  assertIncludes(adoptYamlContent, 'managed_by: user', 'adopt tier should set managed_by: user');

  // default (no env): same as bootstrap
  childProcess.execFileSync(process.execPath, [detectPath, '--refresh'], {
    cwd: projectRoot,
    stdio: 'pipe',
    encoding: 'utf8',
    env: { ...env, DEVKIT_INIT_TIER: '' },
  });
  const defaultYamlContent = readRequiredFile(yamlPath);
  assertIncludes(defaultYamlContent, 'managed_by: devkit', 'default (no tier env) should set managed_by: devkit');
}

function assertManagedBlock(projectRoot) {
  const installPath = path.join(ROOT, 'bin', 'install.js');

  // Scenario 1: fresh project install creates CLAUDE.md with managed block
  const freshRoot = path.join(path.dirname(projectRoot), 'fresh-fixture');
  fs.mkdirSync(freshRoot, { recursive: true });
  const freshPackageJson = { name: 'fresh-test', version: '0.0.1', private: true };
  fs.writeFileSync(path.join(freshRoot, 'package.json'), `${JSON.stringify(freshPackageJson, null, 2)}\n`, 'utf8');

  childProcess.execFileSync(process.execPath, [installPath, '--project'], {
    cwd: freshRoot,
    stdio: 'pipe',
    env: { ...process.env },
  });

  const freshClaudeMdPath = path.join(freshRoot, 'CLAUDE.md');
  assertIncludes(readRequiredFile(freshClaudeMdPath), '<!-- devkit-managed:start', 'fresh install should create managed block start');
  assertIncludes(readRequiredFile(freshClaudeMdPath), '<!-- devkit-managed:end -->', 'fresh install should create managed block end');
  assertIncludes(readRequiredFile(freshClaudeMdPath), '### Installed Skills', 'fresh install managed block should contain skills section');

  // Scenario 2: existing CLAUDE.md without block — append block, preserve user content
  const adoptRoot = path.join(path.dirname(projectRoot), 'adopt-fixture');
  fs.mkdirSync(adoptRoot, { recursive: true });
  fs.writeFileSync(path.join(adoptRoot, 'package.json'), `${JSON.stringify(freshPackageJson, null, 2)}\n`, 'utf8');
  const userContent = '# My Project\n\nThis is my custom CLAUDE.md content.\n';
  fs.writeFileSync(path.join(adoptRoot, 'CLAUDE.md'), userContent, 'utf8');

  childProcess.execFileSync(process.execPath, [installPath, '--project'], {
    cwd: adoptRoot,
    stdio: 'pipe',
    env: { ...process.env },
  });

  const adoptClaudeMd = readRequiredFile(path.join(adoptRoot, 'CLAUDE.md'));
  assertIncludes(adoptClaudeMd, userContent.trimEnd(), 'adopt should preserve user content before block');
  assertIncludes(adoptClaudeMd, '<!-- devkit-managed:start', 'adopt should append managed block');

  // Scenario 3: reinstall — only block content changes, user content untouched
  const userBeforeBlock = adoptClaudeMd.split('<!-- devkit-managed:start')[0];
  childProcess.execFileSync(process.execPath, [installPath, '--project'], {
    cwd: adoptRoot,
    stdio: 'pipe',
    env: { ...process.env },
  });
  const reinstallClaudeMd = readRequiredFile(path.join(adoptRoot, 'CLAUDE.md'));
  const userAfterBlock = reinstallClaudeMd.split('<!-- devkit-managed:start')[0];
  if (userBeforeBlock !== userAfterBlock) {
    throw new Error('reinstall should not modify content outside managed block');
  }

  // Scenario 4: broken block — unclosed start marker should error
  const brokenRoot = path.join(path.dirname(projectRoot), 'broken-fixture');
  fs.mkdirSync(brokenRoot, { recursive: true });
  fs.writeFileSync(path.join(brokenRoot, 'package.json'), `${JSON.stringify(freshPackageJson, null, 2)}\n`, 'utf8');
  const brokenContent = '# Broken\n\n<!-- devkit-managed:start version=1 generated_at=2026-01-01T00:00:00Z -->\n## DevKit\n';
  fs.writeFileSync(path.join(brokenRoot, 'CLAUDE.md'), brokenContent, 'utf8');

  let brokenFailed = false;
  try {
    childProcess.execFileSync(process.execPath, [installPath, '--project'], {
      cwd: brokenRoot,
      stdio: 'pipe',
      env: { ...process.env },
    });
  } catch (error) {
    brokenFailed = /Unclosed managed block|out of order/.test(String(error.stderr || error.message));
  }

  if (!brokenFailed) {
    throw new Error('install should fail on unclosed managed block');
  }

  // Cleanup
  fs.rmSync(freshRoot, { recursive: true, force: true });
  fs.rmSync(adoptRoot, { recursive: true, force: true });
  fs.rmSync(brokenRoot, { recursive: true, force: true });
}

function assertAuditDrift(projectRoot) {
  const detectPath = path.join(ROOT, 'bin', 'detect.js');
  const env = { ...process.env };
  const installPath = path.join(ROOT, 'bin', 'install.js');

  // Setup a fixture with installed skills
  const auditRoot = path.join(path.dirname(projectRoot), 'audit-fixture');
  fs.mkdirSync(auditRoot, { recursive: true });
  const pkg = { name: 'audit-test', version: '0.0.1', private: true };
  fs.writeFileSync(path.join(auditRoot, 'package.json'), `${JSON.stringify(pkg, null, 2)}\n`, 'utf8');

  childProcess.execFileSync(process.execPath, [installPath, '--project'], {
    cwd: auditRoot,
    stdio: 'pipe',
    env: { ...process.env },
  });

  // Test 1: delete SKILL.md → audit reports high "missing file"
  const devkitGoSkillMd = path.join(auditRoot, '.claude', 'skills', 'devkit-go', 'SKILL.md');
  const backupSkillMd = fs.readFileSync(devkitGoSkillMd, 'utf8');
  fs.rmSync(devkitGoSkillMd);

  const auditMissing = childProcess.execFileSync(process.execPath, [detectPath], {
    cwd: auditRoot,
    stdio: 'pipe',
    encoding: 'utf8',
    env: { ...env, DEVKIT_INIT_TIER: 'audit' },
  });
  assertIncludes(auditMissing, 'SKILL.md missing', 'audit should report high: SKILL.md missing');
  assertIncludes(auditMissing, '高(必须修复)', 'audit should have high-severity section');

  // Restore SKILL.md
  fs.writeFileSync(devkitGoSkillMd, backupSkillMd, 'utf8');

  // Test 2: change trigger: manual → trigger: auto → audit reports high
  const tamperedContent = backupSkillMd.replace('trigger: manual', 'trigger: auto');
  fs.writeFileSync(devkitGoSkillMd, tamperedContent, 'utf8');

  const auditTrigger = childProcess.execFileSync(process.execPath, [detectPath], {
    cwd: auditRoot,
    stdio: 'pipe',
    encoding: 'utf8',
    env: { ...env, DEVKIT_INIT_TIER: 'audit' },
  });
  assertIncludes(auditTrigger, 'trigger', 'audit should report trigger drift');

  // Restore
  fs.writeFileSync(devkitGoSkillMd, backupSkillMd, 'utf8');

  // Test 3: CLAUDE.md managed block missing entirely → audit reports medium
  const claudeMdPath = path.join(auditRoot, 'CLAUDE.md');
  const claudeMdContent = readRequiredFile(claudeMdPath);
  // Remove entire managed block to trigger drift
  const noBlockContent = claudeMdContent.replace(/<!--\s*devkit-managed:start[\s\S]*?<!--\s*devkit-managed:end\s*-->\n?/, '').trimEnd() + '\n';
  fs.writeFileSync(claudeMdPath, noBlockContent, 'utf8');

  const auditBlock = childProcess.execFileSync(process.execPath, [detectPath], {
    cwd: auditRoot,
    stdio: 'pipe',
    encoding: 'utf8',
    env: { ...env, DEVKIT_INIT_TIER: 'audit' },
  });
  assertIncludes(auditBlock, 'managed block', 'audit should report CLAUDE.md managed block drift');
  assertIncludes(auditBlock, '中(建议修复)', 'audit should have medium-severity section');

  // Cleanup
  fs.rmSync(auditRoot, { recursive: true, force: true });
}

function assertSeedRecommend(projectRoot) {
  const detectPath = path.join(ROOT, 'bin', 'detect.js');
  const env = { ...process.env };

  // Scenario 1: TS project (has package.json) → matches frontend-design seed (has_file: package.json)
  const tsRoot = path.join(path.dirname(projectRoot), 'seed-ts-fixture');
  fs.mkdirSync(tsRoot, { recursive: true });
  const tsPkg = { name: 'seed-ts-test', version: '0.0.1', private: true, dependencies: { typescript: '^5.0.0', react: '^18.0.0' } };
  fs.writeFileSync(path.join(tsRoot, 'package.json'), `${JSON.stringify(tsPkg, null, 2)}\n`, 'utf8');

  const tsOut = childProcess.execFileSync(process.execPath, [detectPath], {
    cwd: tsRoot,
    stdio: 'pipe',
    encoding: 'utf8',
    env: { ...env, DEVKIT_INIT_TIER: 'bootstrap' },
  });
  assertIncludes(tsOut, 'recommended_seeds:', 'TS project should have recommended_seeds section');
  assertIncludes(tsOut, 'name: frontend-design', 'TS project should match frontend-design seed');

  // Scenario 2: unconditional seed (superpowers) always appears
  assertIncludes(tsOut, 'name: superpowers', 'superpowers (unconditional seed) should always appear');

  // Verify new output fields
  assertIncludes(tsOut, 'install:', 'recommended output should include install field');
  assertIncludes(tsOut, 'stars:', 'recommended output should include stars field');
  assertIncludes(tsOut, 'find_skill_hint: true', 'recommended output should include find_skill_hint');

  // Scenario 10: find_mcp_hint always present
  assertIncludes(tsOut, 'find_mcp_hint: true', 'recommended output should include find_mcp_hint');

  // Scenario 3: already-installed skill not recommended
  const installPath = path.join(ROOT, 'bin', 'install.js');
  childProcess.execFileSync(process.execPath, [installPath, '--project'], {
    cwd: tsRoot,
    stdio: 'pipe',
    env: { ...env },
  });
  const installedOut = childProcess.execFileSync(process.execPath, [detectPath, '--refresh'], {
    cwd: tsRoot,
    stdio: 'pipe',
    encoding: 'utf8',
    env: { ...env, DEVKIT_INIT_TIER: 'bootstrap' },
  });
  assertIncludes(installedOut, 'name: superpowers', 'superpowers should still appear (not in installed_skills)');
  assertIncludes(installedOut, 'name: frontend-design', 'frontend-design should still appear (not in installed_skills)');

  // Add superpowers to installed_skills manually and verify exclusion
  const yamlPath = path.join(tsRoot, '.devkit', 'project.yaml');
  let yamlContent = fs.readFileSync(yamlPath, 'utf8');
  yamlContent = yamlContent.replace('installed_skills: [devkit-go, devkit-init]', 'installed_skills: [superpowers, devkit-go, devkit-init]');
  fs.writeFileSync(yamlPath, yamlContent, 'utf8');
  const excludeOut = childProcess.execFileSync(process.execPath, [detectPath], {
    cwd: tsRoot,
    stdio: 'pipe',
    encoding: 'utf8',
    env: { ...env, DEVKIT_INIT_TIER: 'bootstrap' },
  });
  assertNotIncludes(excludeOut, 'name: superpowers', 'superpowers should be excluded when already installed');

  // Scenario 4: no matching seeds → find-skill hint
  const bareRoot = path.join(path.dirname(projectRoot), 'seed-bare-fixture');
  fs.mkdirSync(bareRoot, { recursive: true });
  const barePkg = { name: 'seed-bare-test', version: '0.0.1', private: true };
  fs.writeFileSync(path.join(bareRoot, 'package.json'), `${JSON.stringify(barePkg, null, 2)}\n`, 'utf8');

  const seedsPath = path.join(ROOT, 'skills', 'devkit-init', 'seeds.yaml');
  const seedsBackup = fs.readFileSync(seedsPath, 'utf8');
  fs.writeFileSync(seedsPath, 'seeds:\n  - name: "only-internal"\n    description: "test"\n    source: "test"\n    install: "npx test"\n    stars: 100\n    when:\n      is_internal: true\n    priority: 1\n', 'utf8');

  const bareOut = childProcess.execFileSync(process.execPath, [detectPath], {
    cwd: bareRoot,
    stdio: 'pipe',
    encoding: 'utf8',
    env: { ...env, DEVKIT_INIT_TIER: 'bootstrap' },
  });
  assertIncludes(bareOut, 'recommended_seeds: []', 'no matching seeds should output empty list');
  assertIncludes(bareOut, 'find-skill', 'no seeds should hint find-skill');

  // Restore seeds.yaml
  fs.writeFileSync(seedsPath, seedsBackup, 'utf8');

  // Scenario 5: malformed seeds.yaml → graceful degradation
  fs.writeFileSync(seedsPath, 'this is not valid yaml {{{', 'utf8');
  const malformedOut = childProcess.execFileSync(process.execPath, [detectPath], {
    cwd: bareRoot,
    stdio: 'pipe',
    encoding: 'utf8',
    env: { ...env, DEVKIT_INIT_TIER: 'bootstrap' },
  });
  assertIncludes(malformedOut, 'project:', 'malformed seeds.yaml should not block bootstrap');

  // Restore seeds.yaml
  fs.writeFileSync(seedsPath, seedsBackup, 'utf8');

  // Scenario 6: scale_gte match — create a large project to get scale=M or L
  const largeRoot = path.join(path.dirname(projectRoot), 'seed-large-fixture');
  fs.mkdirSync(largeRoot, { recursive: true });
  const largePkg = { name: 'seed-large-test', version: '0.0.1', private: true };
  fs.writeFileSync(path.join(largeRoot, 'package.json'), `${JSON.stringify(largePkg, null, 2)}\n`, 'utf8');
  // Create enough files to push scale to M (need ~15000 loc or ~38 modules)
  const srcDir = path.join(largeRoot, 'src');
  fs.mkdirSync(srcDir, { recursive: true });
  for (let i = 0; i < 40; i++) {
    const lines = [];
    for (let j = 0; j < 400; j++) lines.push(`export const mod${i}_line${j} = ${j};`);
    fs.writeFileSync(path.join(srcDir, `module${i}.js`), lines.join('\n'), 'utf8');
  }
  const largeOut = childProcess.execFileSync(process.execPath, [detectPath], {
    cwd: largeRoot,
    stdio: 'pipe',
    encoding: 'utf8',
    env: { ...env, DEVKIT_INIT_TIER: 'bootstrap' },
  });
  assertIncludes(largeOut, 'name: bmad-method', 'large project should match bmad-method (scale_gte: M)');
  assertIncludes(largeOut, 'name: promptfoo', 'large project should match promptfoo (scale_gte: M)');

  // Scenario 7: scale_gte no match — small project, verify bmad-method and promptfoo excluded
  fs.writeFileSync(seedsPath, seedsBackup, 'utf8');
  // bareRoot already has a minimal package.json, scale will be XS
  // Remove cached project.yaml to force rescan with current seeds
  const bareYamlPath = path.join(bareRoot, '.devkit', 'project.yaml');
  if (fs.existsSync(bareYamlPath)) fs.rmSync(bareYamlPath);
  const smallOut = childProcess.execFileSync(process.execPath, [detectPath], {
    cwd: bareRoot,
    stdio: 'pipe',
    encoding: 'utf8',
    env: { ...env, DEVKIT_INIT_TIER: 'bootstrap' },
  });
  assertNotIncludes(smallOut, 'name: bmad-method', 'small project should not match bmad-method');
  assertNotIncludes(smallOut, 'name: promptfoo', 'small project should not match promptfoo');

  // Cleanup
  fs.rmSync(tsRoot, { recursive: true, force: true });
  fs.rmSync(bareRoot, { recursive: true, force: true });
  fs.rmSync(largeRoot, { recursive: true, force: true });

  // Scenario 8: MCP seed appears in recommendations
  // MCP seeds have high priority (21-24) and may be outside Top 8 with normal seeds.
  // Use a minimal seeds.yaml with only MCP entries to isolate the test.
  const mcpSeedsYaml = [
    'seeds:',
    '  - name: context7-mcp',
    '    type: mcp',
    '    description: "MCP test"',
    '    source: "github.com/upstash/context7"',
    '    install: "claude mcp add --transport stdio context7 -- npx -y @upstash/context7-mcp"',
    '    stars: 55000',
    '    priority: 1',
    '    mcp_config:',
    '      transport: stdio',
    '      command: npx',
    '      args: ["-y", "@upstash/context7-mcp"]',
    '      scope: user',
    '    requires_auth: false',
    '  - name: github-mcp',
    '    type: mcp',
    '    description: "GitHub MCP test"',
    '    source: "github.com/modelcontextprotocol/servers"',
    '    install: "claude mcp add --transport http github https://api.githubcopilot.com/mcp/"',
    '    stars: 40000',
    '    priority: 2',
    '    mcp_config:',
    '      transport: http',
    '      url: "https://api.githubcopilot.com/mcp/"',
    '      env_keys: ["GITHUB_PERSONAL_ACCESS_TOKEN"]',
    '      scope: user',
    '    requires_auth: true',
    '',
  ].join('\n');

  const mcpRoot = path.join(path.dirname(projectRoot), 'seed-mcp-fixture');
  fs.mkdirSync(mcpRoot, { recursive: true });
  const mcpPkg = { name: 'mcp-test', version: '0.0.1', private: true };
  fs.writeFileSync(path.join(mcpRoot, 'package.json'), `${JSON.stringify(mcpPkg, null, 2)}\n`, 'utf8');

  const seedsBackup2 = fs.readFileSync(seedsPath, 'utf8');
  fs.writeFileSync(seedsPath, mcpSeedsYaml, 'utf8');

  const mcpOut = childProcess.execFileSync(process.execPath, [detectPath], {
    cwd: mcpRoot,
    stdio: 'pipe',
    encoding: 'utf8',
    env: { ...env, DEVKIT_INIT_TIER: 'bootstrap' },
  });
  assertIncludes(mcpOut, 'name: context7-mcp', 'MCP seed context7-mcp should appear');
  assertIncludes(mcpOut, 'type: mcp', 'MCP seed should output type: mcp');

  // Scenario 9: MCP requires_auth flag
  assertIncludes(mcpOut, 'name: github-mcp', 'MCP seed github-mcp should appear');
  assertIncludes(mcpOut, 'requires_auth: true', 'github-mcp should have requires_auth: true');

  // Restore seeds.yaml
  fs.writeFileSync(seedsPath, seedsBackup2, 'utf8');

  // Cleanup
  fs.rmSync(mcpRoot, { recursive: true, force: true });

  // Scenario 11: MCP seed outputs mcp_scope field
  const mcpScopeRoot = path.join(path.dirname(projectRoot), 'seed-mcp-scope-fixture');
  fs.mkdirSync(mcpScopeRoot, { recursive: true });
  fs.writeFileSync(path.join(mcpScopeRoot, 'package.json'), JSON.stringify({ name: 'mcp-scope-test', version: '0.0.1', private: true }, null, 2) + '\n', 'utf8');

  const seedsBackupForScope = fs.readFileSync(seedsPath, 'utf8');
  fs.writeFileSync(seedsPath, [
    'seeds:',
    '  - name: test-mcp-server',
    '    type: mcp',
    '    description: "test mcp"',
    '    source: "test"',
    '    install: "claude mcp add test"',
    '    stars: 100',
    '    priority: 1',
    '    mcp_config:',
    '      transport: stdio',
    '      command: npx',
    '      args: ["-y", "test-mcp"]',
    '      scope: user',
    '    requires_auth: true',
    '',
  ].join('\n'), 'utf8');

  const mcpScopeOut = childProcess.execFileSync(process.execPath, [detectPath], {
    cwd: mcpScopeRoot,
    stdio: 'pipe',
    encoding: 'utf8',
    env: { ...env, DEVKIT_INIT_TIER: 'bootstrap' },
  });
  assertIncludes(mcpScopeOut, 'type: mcp', 'MCP seed should output type: mcp');
  assertIncludes(mcpScopeOut, 'requires_auth: true', 'MCP seed should output requires_auth');
  assertIncludes(mcpScopeOut, 'mcp_scope: user', 'MCP seed should output mcp_scope');

  // Restore seeds.yaml and cleanup
  fs.writeFileSync(seedsPath, seedsBackupForScope, 'utf8');
  fs.rmSync(mcpScopeRoot, { recursive: true, force: true });
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
