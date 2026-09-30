/**
 * The compaction backend: class identity and the summarize() delegation
 * (trim, then the stock engine path with the prepared messages).
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import QwenLocalCompaction from '../src/backend.js'
import BasicCompactionEngine from '@deepseek-ai/dsh-compaction-basic'
import { NS, publishLiveConfig } from '../src/settings-section.js'

/** A fake context serving one settings section (undefined = no namespace). */
function ctxWithSection(section) {
  return {
    get: (name) => name === 'settings'
      ? { get: (ns) => (ns === NS ? section : undefined) }
      : undefined,
  }
}

/** A prototype-built engine with the row config a preset mount would resolve. */
function engineWith(ctx) {
  const backend = Object.create(QwenLocalCompaction.prototype)
  backend.ctx = ctx
  backend.config = { thresholdRatio: 0.8, retainRatio: 0.16, headroomTokens: 0, maxTokens: 24576 }
  backend.baseConfig = backend.config
  return backend
}

test('backend: compactIfNeeded applies the live compactThresholdPct as the thresholdRatio and the wall guard as headroom', async () => {
  const original = BasicCompactionEngine.prototype.compactIfNeeded
  const seen = []
  try {
    BasicCompactionEngine.prototype.compactIfNeeded = async function () {
      seen.push({ thresholdRatio: this.config.thresholdRatio, maxTokens: this.config.maxTokens, retainRatio: this.config.retainRatio, headroomTokens: this.config.headroomTokens })
      return null
    }
    const backend = engineWith(ctxWithSection({ compactThresholdPct: 90, contextWindow: 262144, maxTokens: 40960 }))
    await backend.compactIfNeeded('agent', 'pressure', undefined)
    assert.deepEqual(seen, [{ thresholdRatio: 0.9, maxTokens: 24576, retainRatio: 0.16, headroomTokens: 10240 }])
  } finally {
    BasicCompactionEngine.prototype.compactIfNeeded = original
  }
})

test('backend: the wall guard shrinks to a quarter of the pressure budget on narrow lines', async () => {
  const original = BasicCompactionEngine.prototype.compactIfNeeded
  const seen = []
  try {
    BasicCompactionEngine.prototype.compactIfNeeded = async function () {
      seen.push(this.config.headroomTokens)
      return null
    }
    await engineWith(ctxWithSection({ compactThresholdPct: 90, contextWindow: 40000, maxTokens: 20000 })).compactIfNeeded('agent', 'pressure', undefined)
    await engineWith(ctxWithSection({ compactThresholdPct: 90 })).compactIfNeeded('agent', 'pressure', undefined)
    assert.deepEqual(seen, [5000, 10000])
  } finally {
    BasicCompactionEngine.prototype.compactIfNeeded = original
  }
})

test('backend: headroomTokens is the linear quarter-of-cap guard, independent of percent', async () => {
  const original = BasicCompactionEngine.prototype.compactIfNeeded
  const seen = []
  try {
    BasicCompactionEngine.prototype.compactIfNeeded = async function () {
      seen.push({ headroomTokens: this.config.headroomTokens, thresholdRatio: this.config.thresholdRatio })
      return null
    }
    // Same 262144/40960 line at several percents: the guard is a quarter of the
    // cap regardless of percent (the slider moves the ratio; the settings tab
    // keeps the cap synced), while the ratio follows the percent.
    for (const pct of [50, 84, 90, 95]) {
      await engineWith(ctxWithSection({ compactThresholdPct: pct, contextWindow: 262144, maxTokens: 40960 })).compactIfNeeded('agent', 'pressure', undefined)
    }
    assert.deepEqual(seen.map((s) => s.headroomTokens), [10240, 10240, 10240, 10240])
    assert.deepEqual(seen.map((s) => s.thresholdRatio), [0.5, 0.84, 0.9, 0.95])
  } finally {
    BasicCompactionEngine.prototype.compactIfNeeded = original
  }
})

test('backend: compactIfNeeded unwraps a wrapped volatile leaf and ignores out-of-range values', async () => {
  const original = BasicCompactionEngine.prototype.compactIfNeeded
  const seen = []
  try {
    BasicCompactionEngine.prototype.compactIfNeeded = async function () {
      seen.push(this.config.thresholdRatio)
      return null
    }
    await engineWith(ctxWithSection({ compactThresholdPct: { get: () => 75 } })).compactIfNeeded('agent', 'pressure', undefined)
    await engineWith(ctxWithSection({ compactThresholdPct: 120 })).compactIfNeeded('agent', 'pressure', undefined)
    await engineWith(ctxWithSection({})).compactIfNeeded('agent', 'pressure', undefined)
    await engineWith(undefined).compactIfNeeded('agent', 'pressure', undefined)
    assert.deepEqual(seen, [0.75, 0.8, 0.8, 0.8])
  } finally {
    BasicCompactionEngine.prototype.compactIfNeeded = original
  }
})

test('backend: the live ratio rebuilds from the row base each evaluation (no drift)', async () => {
  const original = BasicCompactionEngine.prototype.compactIfNeeded
  const seen = []
  try {
    BasicCompactionEngine.prototype.compactIfNeeded = async function () {
      seen.push(this.config.thresholdRatio)
      return null
    }
    let pct = 90
    const ctx = { get: (name) => name === 'settings' ? { get: (ns) => (ns === NS ? { compactThresholdPct: pct } : undefined) } : undefined }
    const backend = engineWith(ctx)
    await backend.compactIfNeeded('agent', 'pressure', undefined)
    pct = 70
    await backend.compactIfNeeded('agent', 'pressure', undefined)
    pct = undefined
    await backend.compactIfNeeded('agent', 'pressure', undefined)
    assert.deepEqual(seen, [0.9, 0.7, 0.8])
  } finally {
    BasicCompactionEngine.prototype.compactIfNeeded = original
  }
})

test('backend: the live-config mirror (the 0.2.0 route) feeds the ratio hot, over the legacy seam', async () => {
  const original = BasicCompactionEngine.prototype.compactIfNeeded
  const seen = []
  try {
    BasicCompactionEngine.prototype.compactIfNeeded = async function () {
      seen.push(this.config.thresholdRatio)
      return null
    }
    // A 0.2.0-shaped receiver: the settings service exists but carries no get(ns).
    const ctx = { get: (name) => (name === 'settings' ? { describe: () => [] } : undefined) }
    let current = 60
    publishLiveConfig({ compactThresholdPct: { get: () => current } })
    try {
      const backend = engineWith(ctx)
      await backend.compactIfNeeded('agent', 'pressure', undefined)
      // A hot commit moves the wrapped leaf's get(); no republish is needed.
      current = 70
      await backend.compactIfNeeded('agent', 'pressure', undefined)
    } finally {
      publishLiveConfig(undefined)
    }
    // Mirror cleared and no legacy seam: the row base stands.
    await engineWith(ctx).compactIfNeeded('agent', 'pressure', undefined)
    // The mirror takes precedence over a legacy section carrying a different value.
    publishLiveConfig({ compactThresholdPct: 55 })
    try {
      await engineWith(ctxWithSection({ compactThresholdPct: 90 })).compactIfNeeded('agent', 'pressure', undefined)
    } finally {
      publishLiveConfig(undefined)
    }
    assert.deepEqual(seen, [0.6, 0.7, 0.8, 0.55])
  } finally {
    BasicCompactionEngine.prototype.compactIfNeeded = original
  }
})

test('backend: summarize trim knobs read the live-config mirror', async () => {
  const original = BasicCompactionEngine.prototype.summarize
  const calls = []
  try {
    BasicCompactionEngine.prototype.summarize = async function (input) { calls.push(input); return { blocks: [] } }
    const envBackup = process.env.DSH_QWEN38_SUMMARIZE_KEEP_TURNS
    delete process.env.DSH_QWEN38_SUMMARIZE_KEEP_TURNS
    publishLiveConfig({ summarize: { images: 'strip', keepTurns: 0, toolChars: 2000 } })
    try {
      const backend = Object.create(QwenLocalCompaction.prototype)
      backend.ctx = { get: () => undefined }
      const messages = [
        { role: 'assistant', content: [{ type: 'reasoning', text: 'old thinking' }, { type: 'text', text: 't' }] },
        { role: 'user', content: [{ type: 'text', text: 'q' }] },
      ]
      await backend.summarize({ messages }, 'the-agent', undefined)
      assert.equal(calls.length, 1)
      // keepTurns 0 came from the mirror, not the env: reasoning stripped.
      assert.deepEqual(calls[0].messages[0].content, [{ type: 'text', text: 't' }])
    } finally {
      publishLiveConfig(undefined)
      if (envBackup !== undefined) process.env.DSH_QWEN38_SUMMARIZE_KEEP_TURNS = envBackup
    }
  } finally {
    BasicCompactionEngine.prototype.summarize = original
  }
})

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
