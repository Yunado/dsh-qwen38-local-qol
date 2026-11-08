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

/** A settings context serving one line geometry (the legacy seam). */
function ctxWithGeometry(geometry) {
  return {
    get: (name) => name === 'settings'
      ? { get: (ns) => (ns === NS ? geometry : undefined) }
      : undefined,
  }
}

/** One user message of exactly `tokens` estimated tokens (3 chars each). */
function prefillOf(tokens) {
  return [{ role: 'user', content: [{ type: 'text', text: 'x'.repeat(tokens * 3) }] }]
}

test('backend: summarize derives the call cap from the trimmed prefill and the line window', async () => {
  const original = BasicCompactionEngine.prototype.summarize
  const seen = []
  try {
    BasicCompactionEngine.prototype.summarize = async function () { seen.push(this.config.maxTokens); return { blocks: [] } }
    // A narrow line with a verbose-prefill call: 90,000 window, 15,000 line
    // cap, 50,000-token prefill -> desired = ceil(0.75 x 50,000) = 37,500,
    // under the upper bound 90,000 - 50,000 - 2,048.
    const backend = engineWith(ctxWithGeometry({ contextWindow: 90000, maxTokens: 15000 }))
    await backend.summarize({ messages: prefillOf(50000) }, 'agent', undefined)
    assert.deepEqual(seen, [37500])
    // The swap rebuilds from the row base each call: the next small prefill
    // returns to the floor (max(row 24,576, line 15,000)), no ratchet.
    await backend.summarize({ messages: prefillOf(10) }, 'agent', undefined)
    assert.deepEqual(seen[1], 24576)
  } finally {
    BasicCompactionEngine.prototype.summarize = original
  }
})

test('backend: the cap floor follows the line cap when the line allows more (the wire raise, as a floor)', async () => {
  const original = BasicCompactionEngine.prototype.summarize
  const seen = []
  try {
    BasicCompactionEngine.prototype.summarize = async function () { seen.push(this.config.maxTokens); return { blocks: [] } }
    // The production line (262,144 / 41,943) with a small prefill: the floor
    // is max(row 24,576, line 41,943) = 41,943 - what the wire's max() raise
    // sends today, now visible to the geometry check.
    const backend = engineWith(ctxWithGeometry({ contextWindow: 262144, maxTokens: 41943 }))
    await backend.summarize({ messages: prefillOf(100) }, 'agent', undefined)
    assert.deepEqual(seen, [41943])
  } finally {
    BasicCompactionEngine.prototype.summarize = original
  }
})

test('backend: a geometrically hopeless prefill is refused before the call', async () => {
  const original = BasicCompactionEngine.prototype.summarize
  let called = 0
  try {
    BasicCompactionEngine.prototype.summarize = async function () { called += 1; return { blocks: [] } }
    // 90,000 line with an 80,000-token prefill: upper = 7,952 < floor 24,576.
    const backend = engineWith(ctxWithGeometry({ contextWindow: 90000, maxTokens: 15000 }))
    await assert.rejects(
      () => backend.summarize({ messages: prefillOf(80000) }, 'agent', undefined),
      /compaction refused before the call.*needs at least 24576/s,
    )
    assert.equal(called, 0)
  } finally {
    BasicCompactionEngine.prototype.summarize = original
  }
})

test('backend: summarize.capRatio comes from the knobs', async () => {
  const original = BasicCompactionEngine.prototype.summarize
  const seen = []
  const envName = 'DSH_QWEN38_SUMMARIZE_CAP_RATIO'
  const envBackup = process.env[envName]
  try {
    BasicCompactionEngine.prototype.summarize = async function () { seen.push(this.config.maxTokens); return { blocks: [] } }
    // Same 30,000-token prefill on the 90,000 line: at the 0.75 default the
    // desired (22,500) stays under the floor, so the row cap stands...
    delete process.env[envName]
    const backend = engineWith(ctxWithGeometry({ contextWindow: 90000, maxTokens: 15000 }))
    await backend.summarize({ messages: prefillOf(30000) }, 'agent', undefined)
    // ...and at 1.2 the same prefill asks for ceil(1.2 x 30,000) = 36,000.
    process.env[envName] = '1.2'
    await backend.summarize({ messages: prefillOf(30000) }, 'agent', undefined)
    // A malformed value falls back to the default, never to a wild cap.
    process.env[envName] = '99'
    await backend.summarize({ messages: prefillOf(30000) }, 'agent', undefined)
    assert.deepEqual(seen, [24576, 36000, 24576])
  } finally {
    if (envBackup === undefined) delete process.env[envName]
    else process.env[envName] = envBackup
    BasicCompactionEngine.prototype.summarize = original
  }
})

test('backend: without a resolvable geometry the pinned row cap stands unchanged', async () => {
  const original = BasicCompactionEngine.prototype.summarize
  const seen = []
  try {
    BasicCompactionEngine.prototype.summarize = async function () { seen.push(this.config.maxTokens); return { blocks: [] } }
    const backend = engineWith(ctxWithGeometry({}))
    await backend.summarize({ messages: prefillOf(50000) }, 'agent', undefined)
    assert.deepEqual(seen, [24576])
  } finally {
    BasicCompactionEngine.prototype.summarize = original
  }
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
