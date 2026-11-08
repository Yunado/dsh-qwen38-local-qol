/**
 * The prefill estimator and the `capRatio` knob resolution added with the
 * adaptive summary cap (v0.3.7).
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { DEFAULT_TRIM_KNOBS, resolveTrimKnobs, estimatePrefillTokens } from '../src/prepare.js'

test('DEFAULT_TRIM_KNOBS carry the capRatio default', () => {
  assert.equal(DEFAULT_TRIM_KNOBS.capRatio, 0.75)
})

test('resolveTrimKnobs: capRatio parses a bounded float, malformed values keep the default', () => {
  assert.equal(resolveTrimKnobs({ DSH_QWEN38_SUMMARIZE_CAP_RATIO: '1.2' }).capRatio, 1.2)
  assert.equal(resolveTrimKnobs({ DSH_QWEN38_SUMMARIZE_CAP_RATIO: '0.1' }).capRatio, 0.1)
  assert.equal(resolveTrimKnobs({ DSH_QWEN38_SUMMARIZE_CAP_RATIO: '0.05' }).capRatio, 0.75)
  assert.equal(resolveTrimKnobs({ DSH_QWEN38_SUMMARIZE_CAP_RATIO: '3' }).capRatio, 0.75)
  assert.equal(resolveTrimKnobs({ DSH_QWEN38_SUMMARIZE_CAP_RATIO: 'abc' }).capRatio, 0.75)
  assert.equal(resolveTrimKnobs({}).capRatio, 0.75)
})

test('estimatePrefillTokens: 3 chars per token over text, reasoning, and tool payloads', () => {
  const messages = [
    { role: 'user', content: [{ type: 'text', text: 'x'.repeat(300) }] },
    { role: 'assistant', content: [
      { type: 'reasoning', text: 'y'.repeat(90) },
      { type: 'tool-call', name: 'read', input: { file_path: 'a'.repeat(57) } },
    ] },
    { role: 'tool', content: [{ type: 'tool-result', toolCallId: 'c', content: [{ type: 'text', text: 'z'.repeat(600) }] }] },
  ]
  // 300 + 90 + ("read".length 4 + the input JSON) + 600, all /3.
  const toolCallChars = 4 + JSON.stringify({ file_path: 'a'.repeat(57) }).length
  assert.equal(estimatePrefillTokens(messages), Math.ceil((300 + 90 + toolCallChars + 600) / 3))
})

test('estimatePrefillTokens: images price at the pinned per-image cost, tools price as JSON', () => {
  const messages = [{ role: 'user', content: [{ type: 'image', attachment: { name: 'shot.png', mediaType: 'image/png', width: 1920, height: 1080 } }] }]
  assert.equal(estimatePrefillTokens(messages), 1536)
  const tools = [{ type: 'function', name: 'x', parameters: {} }]
  assert.equal(estimatePrefillTokens([], tools), Math.ceil(JSON.stringify(tools).length / 3))
})
