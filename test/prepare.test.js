/**
 * Region preparation for the summarizer prefill: reasoning retention, image
 * stripping, and tool-result capping, plus the knob resolution.
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { prepareSummaryRegion, keepRecentReasoning, resolveTrimKnobs, DEFAULT_TRIM_KNOBS } from '../src/prepare.js'

function msg(role, blocks) {
  return { role, content: blocks }
}
const text = (t) => ({ type: 'text', text: t })
const reasoning = (t) => ({ type: 'reasoning', text: t })
const image = () => ({ type: 'image', attachment: { name: 'a.png', mediaType: 'image/png', width: 100, height: 50 } })
const toolResult = (toolCallId, t, isError) => ({ type: 'tool-result', toolCallId, content: [text(t)], ...(isError ? { isError: true } : {}) })

test('keepRecentReasoning: keeps the last N assistant turns, strips older reasoning', () => {
  const messages = [
    msg('assistant', [reasoning('old-1'), text('o1')]),
    msg('user', [text('q2')]),
    msg('assistant', [reasoning('old-2'), text('o2')]),
    msg('user', [text('q3')]),
    msg('assistant', [reasoning('new-1'), text('n1')]),
    msg('user', [text('q4')]),
    msg('assistant', [reasoning('new-2'), text('n2')]),
  ]
  const prepared = keepRecentReasoning(messages, 2)
  assert.deepEqual(prepared[0].content, [text('o1')])
  assert.deepEqual(prepared[2].content, [text('o2')])
  assert.deepEqual(prepared[4].content, [reasoning('new-1'), text('n1')])
  assert.deepEqual(prepared[6].content, [reasoning('new-2'), text('n2')])
  // user messages pass through untouched
  assert.deepEqual(prepared[1], messages[1])
})

test('keepRecentReasoning: 0 strips all reasoning; model sources lose their replay projection', () => {
  const messages = [
    { role: 'assistant', content: [reasoning('r'), text('t')], source: { kind: 'model', provider: 'p', model: 'm', blocks: 2 } },
  ]
  const prepared = keepRecentReasoning(messages, 0)
  assert.deepEqual(prepared[0].content, [text('t')])
  assert.deepEqual(prepared[0].source, { kind: 'model', provider: 'p', model: 'm' })
  // non-model sources are preserved as-is
  const plugin = [{ role: 'assistant', content: [reasoning('r'), text('t')], source: { kind: 'plugin', plugin: 'x' } }]
  assert.deepEqual(keepRecentReasoning(plugin, 0)[0].source, { kind: 'plugin', plugin: 'x' })
})

test('prepareSummaryRegion: strips images including nested in tool results', () => {
  const messages = [
    msg('user', [text('see'), image()]),
    msg('user', [toolResult('c1', 'x', false)]),
  ]
  const nested = [
    msg('user', [
      { type: 'tool-result', toolCallId: 'c2', content: [text('top'), image(), { type: 'tool-result', toolCallId: 'c3', content: [image()] }] },
    ]),
  ]
  const prepared = prepareSummaryRegion(messages, DEFAULT_TRIM_KNOBS)
  assert.deepEqual(prepared[0].content, [text('see'), { type: 'text', text: '[image: a.png 100x50]' }])

  const preparedNested = prepareSummaryRegion(nested, DEFAULT_TRIM_KNOBS)
  const outer = preparedNested[0].content[0]
  assert.deepEqual(outer.content[1], { type: 'text', text: '[image: a.png 100x50]' })
  assert.deepEqual(outer.content[2].content[0], { type: 'text', text: '[image: a.png 100x50]' })
})

test('prepareSummaryRegion: keep images when configured', () => {
  const messages = [msg('user', [image()])]
  const prepared = prepareSummaryRegion(messages, { images: 'keep', keepTurns: 5, toolChars: 2000 })
  assert.equal(prepared[0].content[0].type, 'image')
})

test('prepareSummaryRegion: caps oversized tool results with an elided marker, nested included', () => {
  const long = 'x'.repeat(2600)
  const messages = [msg('user', [toolResult('c1', long)])]
  const prepared = prepareSummaryRegion(messages, { images: 'keep', keepTurns: 5, toolChars: 2000 })
  const capped = prepared[0].content[0].content[0].text
  assert.equal(capped.length, 2000 + '\n… [600 more chars elided]'.length)
  assert.ok(capped.endsWith('\n… [600 more chars elided]'))
  // short results pass through unchanged
  const short = prepareSummaryRegion([msg('user', [toolResult('c2', 'tiny')])], { images: 'keep', keepTurns: 5, toolChars: 2000 })
  assert.equal(short[0].content[0].content[0].text, 'tiny')
})

test('prepareSummaryRegion: toolChars 0 disables capping', () => {
  const long = 'x'.repeat(5000)
  const prepared = prepareSummaryRegion([msg('user', [toolResult('c1', long)])], { images: 'keep', keepTurns: 5, toolChars: 0 })
  assert.equal(prepared[0].content[0].content[0].text, long)
})

test('resolveTrimKnobs: defaults and env parsing', () => {
  assert.deepEqual(resolveTrimKnobs({}), DEFAULT_TRIM_KNOBS)
  assert.deepEqual(
    resolveTrimKnobs({ DSH_QWEN38_SUMMARIZE_IMAGES: 'keep', DSH_QWEN38_SUMMARIZE_KEEP_TURNS: '2', DSH_QWEN38_SUMMARIZE_TOOL_CHARS: '100' }),
    { images: 'keep', keepTurns: 2, toolChars: 100 },
  )
  assert.deepEqual(
    resolveTrimKnobs({ DSH_QWEN38_SUMMARIZE_IMAGES: 'bogus', DSH_QWEN38_SUMMARIZE_KEEP_TURNS: 'x', DSH_QWEN38_SUMMARIZE_TOOL_CHARS: '-3' }),
    DEFAULT_TRIM_KNOBS,
  )
})
