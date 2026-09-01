/**
 * The compaction backend: class identity and the summarize() delegation
 * (trim, then the stock engine path with the prepared messages).
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import QwenLocalCompaction from '../src/backend.js'
import BasicCompactionEngine from '@deepseek-ai/dsh-compaction-basic'

test('backend: default export is the class and extends the stock engine', () => {
  assert.equal(typeof QwenLocalCompaction, 'function')
  assert.equal(QwenLocalCompaction.name, 'QwenLocalCompaction')
  assert.ok(QwenLocalCompaction.prototype instanceof BasicCompactionEngine)
})

test('backend: summarize trims the region, then delegates to the stock path', async () => {
  const original = BasicCompactionEngine.prototype.summarize
  const calls = []
  try {
    BasicCompactionEngine.prototype.summarize = async function (input, agent, signal) {
      calls.push({ input, agent, signal })
      return { blocks: [{ type: 'text', text: 'checkpoint' }] }
    }

    // Environment knob: keep zero assistant turns of reasoning, so a single
    // old reasoning block must be stripped by the trim.
    const envBackup = process.env.DSH_QWEN38_SUMMARIZE_KEEP_TURNS
    process.env.DSH_QWEN38_SUMMARIZE_KEEP_TURNS = '0'
    try {
      const backend = Object.create(QwenLocalCompaction.prototype)
      const messages = [
        { role: 'assistant', content: [{ type: 'reasoning', text: 'old thinking' }, { type: 'text', text: 't' }] },
        { role: 'user', content: [{ type: 'text', text: 'q' }] },
      ]
      const result = await backend.summarize({ messages, other: 'kept' }, 'the-agent', 'the-signal')

      assert.equal(calls.length, 1)
      assert.equal(calls[0].agent, 'the-agent')
      assert.equal(calls[0].signal, 'the-signal')
      assert.equal(calls[0].input.other, 'kept')
      // The original input is not mutated.
      assert.equal(messages[0].content[0].type, 'reasoning')
      // The delegated input carries the prepared messages: reasoning stripped.
      const prepared = calls[0].input.messages
      assert.deepEqual(prepared[0].content, [{ type: 'text', text: 't' }])
      assert.equal(result.blocks[0].text, 'checkpoint')
    } finally {
      if (envBackup === undefined) delete process.env.DSH_QWEN38_SUMMARIZE_KEEP_TURNS
      else process.env.DSH_QWEN38_SUMMARIZE_KEEP_TURNS = envBackup
    }
  } finally {
    BasicCompactionEngine.prototype.summarize = original
  }
})
