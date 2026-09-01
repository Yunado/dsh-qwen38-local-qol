/**
 * The preset generator: row swap, maxTokens pinning, and strict-anchor failure.
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { transformPreset, findNameLine, BACKEND_PACKAGE, BACKEND_MAX_TOKENS } from '../src/setup.js'

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
  assert.equal(lines[idIndex + 3], '        maxTokens: 16384')
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
