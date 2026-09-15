/**
 * The preset generator: row swap, maxTokens pinning, strict-anchor failure,
 * and the default-preset settings.yaml merge.
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import {
  transformPreset,
  findNameLine,
  BACKEND_PACKAGE,
  BACKEND_MAX_TOKENS,
  applyDefaultPreset,
  autoApplyCompaction,
  renderPresetMetadata,
  readDefaultAgentPreset,
  readCompactionStatus,
  writeGeneratedPreset,
  standardPresetPathFrom,
  PRESET_ID,
  PRESET_DESCRIPTIONS,
} from '../src/setup.js'

const PRESET = [
  '- id: agent',
  '  name: cordis:group',
  '  group: true',
  '  config:',
  '    - id: persona',
  '      name: "@deepseek-ai/dsh-system-prompt"',
  '- id: compaction',
  '  name: cordis:group',
  '  group: true',
  '  isolate:',
  '    compaction: true',
  '    toolResultPruner: true',
  '  config:',
  '    - id: compaction-basic',
  '      name: \'@deepseek-ai/dsh-compaction-basic\'',
  '    - id: command-compact',
  '      name: \'@deepseek-ai/dsh-command-compact\'',
  '    - id: tool-result-pruner',
  '      name: \'@deepseek-ai/dsh-compaction-tool-result-pruner\'',
  '      config:',
  '        thresholdChars: 8192',
  '- id: todo',
  '  name: "@deepseek-ai/dsh-tool-todo"',
  '',
].join('\n')

test('transformPreset: swaps the backend name and pins maxTokens', () => {
  const out = transformPreset(PRESET)
  const lines = out.split('\n')
  const idIndex = lines.findIndex((line) => line.trim() === '- id: compaction-basic')
  assert.ok(idIndex !== -1)
  assert.equal(lines[idIndex + 1], `      name: ${BACKEND_PACKAGE}`)
  assert.equal(lines[idIndex + 2], '      config:')
  assert.equal(lines[idIndex + 3], `        maxTokens: ${BACKEND_MAX_TOKENS}`)
  // the rest of the preset is untouched
  assert.ok(out.includes("- id: command-compact"))
  assert.ok(out.includes('thresholdChars: 8192'))
  assert.ok(out.includes('- id: todo'))
})

test('transformPreset: existing config block is not duplicated', () => {
  const withConfig = PRESET
    .split('\n')
    .join('\n')
    .replace('      name: \'@deepseek-ai/dsh-compaction-basic\'\n', '      name: \'@deepseek-ai/dsh-compaction-basic\'\n      config:\n        maxTokens: 16384\n')
  const out = transformPreset(withConfig)
  const count = out.split('\n').filter((line) => line.trim() === 'config:').length
  // agent group's config:, compaction group's config:, the backend block's
  // pre-existing config:, and the pruner's config: — the transform added none.
  assert.equal(count, 4)
  assert.ok(out.includes(`name: ${BACKEND_PACKAGE}`))
  // exactly one maxTokens line: the pre-existing one survived, none was added
  assert.equal(out.match(/maxTokens/g)?.length, 1)
})

test('transformPreset: fails loud on missing or duplicate rows', () => {
  assert.throws(() => transformPreset('- id: other\n  name: x\n'), /no "- id: compaction-basic" row/)
  const doubled = `${PRESET}\n    - id: compaction-basic\n      name: y\n`
  assert.throws(() => transformPreset(doubled), /found 2 "compaction-basic" rows/)
})

test('findNameLine: fails when the next row starts before a name line', () => {
  const lines = ['- id: compaction-basic', '- id: next', '  name: x']
  const idLine = 0
  assert.throws(() => findNameLine(lines, idLine), /no name: line/)
  const lines2 = ['- id: compaction-basic', '  name: y', '  config: {}']
  assert.equal(findNameLine(lines2, 0), 1)
})

test('applyDefaultPreset: creates the section in an empty file', () => {
  const { text, changed } = applyDefaultPreset('')
  assert.equal(changed, 'created')
  assert.equal(text, 'agent-presets:\n  default: qwen38\n')
})

test('applyDefaultPreset: appends the section below existing content', () => {
  const existing = 'ui-theme:\n  preference: dark\nlocale:\n  preference: zh\n'
  const { text, changed } = applyDefaultPreset(existing)
  assert.equal(changed, 'appended')
  assert.ok(text.startsWith(existing))
  assert.ok(text.endsWith(`agent-presets:\n  default: ${PRESET_ID}\n`))
})

test('applyDefaultPreset: appends to a file without a trailing newline', () => {
  const { text, changed } = applyDefaultPreset('ui-theme:\n  preference: dark')
  assert.equal(changed, 'appended')
  assert.equal(text, 'ui-theme:\n  preference: dark\nagent-presets:\n  default: qwen38\n')
})

test('applyDefaultPreset: replaces a foreign default inside the section', () => {
  const existing = 'agent-presets:\n  default: standard\n  enabled: true\nlocale:\n  preference: zh\n'
  const { text, changed } = applyDefaultPreset(existing)
  assert.equal(changed, 'replaced')
  assert.equal(text, `agent-presets:\n  default: ${PRESET_ID}\n  enabled: true\nlocale:\n  preference: zh\n`)
})

test('applyDefaultPreset: inserts a missing default into an existing section', () => {
  const existing = 'agent-presets:\n  enabled: true\nlocale:\n  preference: zh\n'
  const { text, changed } = applyDefaultPreset(existing)
  assert.equal(changed, 'appended')
  assert.equal(text, `agent-presets:\n  default: ${PRESET_ID}\n  enabled: true\nlocale:\n  preference: zh\n`)
})

test('applyDefaultPreset: no-op when the default already matches', () => {
  const existing = `agent-presets:\n  default: ${PRESET_ID}\n`
  const { text, changed } = applyDefaultPreset(existing)
  assert.equal(changed, 'none')
  assert.equal(text, existing)
})

test('applyDefaultPreset: preserves CRLF line endings on replace', () => {
  const existing = 'agent-presets:\r\n  default: standard\r\n'
  const { text, changed } = applyDefaultPreset(existing)
  assert.equal(changed, 'replaced')
  assert.equal(text, `agent-presets:\r\n  default: ${PRESET_ID}\r\n`)
})

test('applyDefaultPreset: uses CRLF when appending to a CRLF file', () => {
  const existing = 'ui-theme:\r\n  preference: dark\r\n'
  const { text, changed } = applyDefaultPreset(existing)
  assert.equal(changed, 'appended')
  assert.equal(text, `ui-theme:\r\n  preference: dark\r\nagent-presets:\r\n  default: ${PRESET_ID}\r\n`)
})

test('applyDefaultPreset: fails loud on an inline agent-presets entry', () => {
  assert.throws(() => applyDefaultPreset('agent-presets: {}\n'), /inline agent-presets entry/)
})

test('applyDefaultPreset: fails loud on a duplicated section', () => {
  assert.throws(() => applyDefaultPreset('agent-presets:\nagent-presets:\n'), /two top-level agent-presets sections/)
})

test('applyDefaultPreset: fails loud on a duplicated default key', () => {
  assert.throws(() => applyDefaultPreset('agent-presets:\n  default: standard\n  default: qwen38\n'), /more than one default key/)
})

test('applyDefaultPreset: leaves a nested agent-presets key alone', () => {
  const existing = 'plugins:\n  agent-presets: true\nlocale:\n  preference: zh\n'
  const { text, changed } = applyDefaultPreset(existing)
  assert.equal(changed, 'appended')
  assert.ok(text.includes('plugins:\n  agent-presets: true'))
})

test('renderPresetMetadata: publishes the name and description as locale maps (resolved per the reader locale by locale-map-capable trees)', () => {
  assert.equal(PRESET_DESCRIPTIONS.zh, '标准模式 + 自定义压缩')
  assert.equal(PRESET_DESCRIPTIONS.en, 'Standard mode + custom compaction')
  assert.equal(renderPresetMetadata(), 'name:\n  zh: Qwen38模式\n  en: Qwen38 mode\ndescription:\n  zh: 标准模式 + 自定义压缩\n  en: Standard mode + custom compaction\n')
})

test('readDefaultAgentPreset: lenient read of the default preset key', () => {
  assert.equal(readDefaultAgentPreset('agent-presets:\n  default: standard\n  enabled: true\nlocale:\n  preference: zh\n'), 'standard')
  assert.equal(readDefaultAgentPreset('agent-presets:\n  enabled: true\nlocale:\n  preference: zh\n'), undefined)
  assert.equal(readDefaultAgentPreset('locale:\n  preference: zh\n'), undefined)
  assert.equal(readDefaultAgentPreset('agent-presets: {}\n'), undefined)
  assert.equal(readDefaultAgentPreset('plugins:\n  agent-presets: true\n'), undefined)
  assert.equal(readDefaultAgentPreset(''), undefined)
  assert.equal(readDefaultAgentPreset('agent-presets:\r\n  default: qwen38\r\n'), 'qwen38')
  // Duplicated sections: the first one wins.
  assert.equal(readDefaultAgentPreset('agent-presets:\n  default: standard\nagent-presets:\n  default: qwen38\n'), 'standard')
})

test('writeGeneratedPreset: one-shot write refuses an existing preset; re-runs back up only changed files', () => {
  const home = mkdtempSync(join(tmpdir(), 'qol-write-preset-'))
  const sourceText = PRESET
  try {
    const first = writeGeneratedPreset(home, sourceText, { overwrite: false })
    assert.ok(existsSync(first.preset))
    assert.ok(existsSync(first.metadata))
    assert.throws(() => writeGeneratedPreset(home, sourceText, { overwrite: false }), /already exists/)
    // Same composition again: a no-op — no rewrite, no new backup.
    const before = readdirSync(dirname(first.preset)).sort()
    const second = writeGeneratedPreset(home, sourceText, { overwrite: true })
    assert.ok(existsSync(second.preset))
    assert.deepEqual(readdirSync(dirname(second.preset)).sort(), before)
    // A changed composition: only the file that actually changed gets a dated
    // backup (the unchanged metadata does not), then the new content.
    writeGeneratedPreset(home, `${sourceText}\n# regenerated\n`, { overwrite: true })
    const backups = readdirSync(dirname(first.preset)).filter((name) => name.includes('.bak-'))
    assert.equal(backups.length, 1)
    assert.match(backups[0], /agent\.cordis\.yml\.bak-/)
    assert.match(readFileSync(first.preset, 'utf8'), /# regenerated/)
  } finally {
    rmSync(home, { recursive: true, force: true })
  }
})

test('readCompactionStatus: reports the preset existence and the default preset', () => {
  const dir = mkdtempSync(join(tmpdir(), 'qol-compaction-status-'))
  try {
    assert.deepEqual(readCompactionStatus(dir), { presetGenerated: false, defaultPreset: 'standard' })
    writeFileSync(join(dir, 'settings.yaml'), 'agent-presets:\n  default: qwen38\n')
    assert.deepEqual(readCompactionStatus(dir), { presetGenerated: false, defaultPreset: 'qwen38' })
    mkdirSync(join(dir, '.agent-presets', 'qwen38'), { recursive: true })
    writeFileSync(join(dir, '.agent-presets', 'qwen38', 'agent.cordis.yml'), '- id: agent\n')
    assert.deepEqual(readCompactionStatus(dir), { presetGenerated: true, defaultPreset: 'qwen38' })
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('autoApplyCompaction: first run generates and sets the default; re-runs and an explicit default are no-ops', () => {
  const home = mkdtempSync(join(tmpdir(), 'qol-auto-apply-'))
  const source = join(home, 'standard.cordis.yml')
  writeFileSync(source, PRESET)
  const realSource = process.env.DSH_QWEN38_PRESET_SRC
  process.env.DSH_QWEN38_PRESET_SRC = source
  try {
    const first = autoApplyCompaction(home)
    assert.equal(first.applied, true)
    assert.ok(existsSync(first.preset))
    assert.ok(existsSync(first.metadata))
    assert.equal(first.defaultChanged, 'created')
    const second = autoApplyCompaction(home)
    assert.equal(second.applied, false)
    assert.equal(second.defaultChanged, 'none')
    // An explicit other default is respected (never replaced at boot).
    writeFileSync(join(home, 'settings.yaml'), 'agent-presets:\n  default: standard\n')
    const third = autoApplyCompaction(home)
    assert.equal(third.applied, false)
    assert.equal(third.defaultChanged, 'none')
    assert.equal(readFileSync(join(home, 'settings.yaml'), 'utf8'), 'agent-presets:\n  default: standard\n')
  } finally {
    if (realSource === undefined) delete process.env.DSH_QWEN38_PRESET_SRC
    else process.env.DSH_QWEN38_PRESET_SRC = realSource
    rmSync(home, { recursive: true, force: true })
  }
})

test('standardPresetPathFrom: resolves via a node_modules chain, undefined when absent', () => {
  const dir = mkdtempSync(join(tmpdir(), 'qol-preset-anchor-'))
  try {
    const anchor = join(dir, 'probe.js')
    assert.equal(standardPresetPathFrom(anchor), undefined)
    const pkgDir = join(dir, 'node_modules', '@deepseek-ai', 'dsh-agent-presets')
    mkdirSync(join(pkgDir, 'presets', 'standard'), { recursive: true })
    writeFileSync(join(pkgDir, 'package.json'), '{"name":"@deepseek-ai/dsh-agent-presets"}\n')
    const composition = join(pkgDir, 'presets', 'standard', 'agent.cordis.yml')
    writeFileSync(composition, '- id: agent\n')
    assert.equal(standardPresetPathFrom(anchor), composition)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('writeGeneratedPreset: keeps only the newest five dated backups', () => {
  const home = mkdtempSync(join(tmpdir(), 'qol-backup-prune-'))
  try {
    writeGeneratedPreset(home, PRESET, { overwrite: true })
    for (let i = 1; i <= 7; i += 1) {
      writeGeneratedPreset(home, `${PRESET}\n# cut ${i}\n`, { overwrite: true })
    }
    const dir = join(home, '.agent-presets', 'qwen38')
    const backups = readdirSync(dir).filter((name) => name.includes('.bak-')).sort()
    assert.equal(backups.length, 5)
    // The latest content survives; the pruned ones are the oldest cuts.
    assert.match(readFileSync(join(dir, 'agent.cordis.yml'), 'utf8'), /# cut 7/)
    assert.match(backups[4], /agent\.cordis\.yml\.bak-/)
  } finally {
    rmSync(home, { recursive: true, force: true })
  }
})

test('autoApplyCompaction: a changed standard composition regenerates the existing preset with a dated backup', () => {
  const home = mkdtempSync(join(tmpdir(), 'qol-auto-apply-resync-'))
  const source = join(home, 'standard.cordis.yml')
  writeFileSync(source, PRESET)
  const realSource = process.env.DSH_QWEN38_PRESET_SRC
  process.env.DSH_QWEN38_PRESET_SRC = source
  try {
    const first = autoApplyCompaction(home)
    assert.equal(first.applied, true)
    const presetFile = join(home, '.agent-presets', 'qwen38', 'agent.cordis.yml')
    const unchanged = autoApplyCompaction(home)
    assert.equal(unchanged.applied, false)
    assert.deepEqual(readdirSync(dirname(presetFile)).filter((name) => name.includes('.bak-')), [])
    // A changed standard composition: the preset is regenerated, and only the
    // changed file gets a dated backup (the metadata stays put).
    writeFileSync(source, `${PRESET}\n# re-cut\n`)
    const resynced = autoApplyCompaction(home)
    assert.equal(resynced.applied, false)
    assert.equal(resynced.preset, presetFile)
    assert.match(readFileSync(presetFile, 'utf8'), /# re-cut/)
    const backups = readdirSync(dirname(presetFile)).filter((name) => name.includes('.bak-'))
    assert.equal(backups.length, 1)
    assert.match(backups[0], /agent\.cordis\.yml\.bak-/)
  } finally {
    if (realSource === undefined) delete process.env.DSH_QWEN38_PRESET_SRC
    else process.env.DSH_QWEN38_PRESET_SRC = realSource
    rmSync(home, { recursive: true, force: true })
  }
})
