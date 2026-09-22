/**
 * The browser half's contract: the settings.section registration, the inject
 * face's load/save against the settings Remote, and the conflict path.
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import * as client from '../src/client.js'

/** A fake client ctx with a settings Remote and a slots surface. */
function fakeCtx(overrides = {}) {
  const describeCalls = []
  const updateCalls = []
  const state = {
    namespaces: [{
      ns: 'qwen38-local-qol',
      revision: 7,
      value: {
        dialect: 'ninfer',
        baseURL: 'http://localhost:8082/v1',
        model: 'qwen3.8-27b-nvfp4',
        displayName: 'Qwen3.8-27B',
        apiKey: '',
        contextWindow: 229376,
        maxTokens: 24576,
        thinkingBudgets: { low: 4096, medium: 8192, xhigh: 16384 },
        defaultEffort: 'medium',
        thinkingLevelMap: {},
        includeUsage: true,
        summarize: { images: 'strip', keepTurns: 5, toolChars: 2000 },
        compaction: { presetGenerated: true, defaultPreset: 'qwen38' },
      },
    }, {
      ns: 'agent-presets',
      revision: 3,
      value: { default: 'standard', enabled: true },
    }],
  }
  const ctx = {
    locale: { getSnapshot: () => ({ active: 'zh' }) },
    slots: {
      inject(_name, callback) { callback() },
      register(_options, _component) {},
    },
    remote: {
      settings: {
        describe: async () => { describeCalls.push(undefined); return { ok: true, value: { namespaces: state.namespaces.map((entry) => ({ ...entry, value: { ...entry.value } })) } } },
        update: async (ns, patch, revision) => {
          updateCalls.push({ ns, patch, revision })
          const index = state.namespaces.findIndex((entry) => entry.ns === ns)
          const target = state.namespaces[index]
          if (overrides.conflictNext && revision !== target.revision) {
            return { ok: false, error: { code: 'settings/conflict', message: 'stale revision' } }
          }
          state.namespaces[index] = { ...target, revision: target.revision + 1, value: { ...target.value, ...patch } }
          return { ok: true, value: state.namespaces[index] }
        },
      },
    },
  }
  return { ctx, describeCalls, updateCalls, state, registrations: { list: [] } }
}

test('client contract: named exports for the function-plugin loader', () => {
  assert.equal(client.name, 'qwen38-local-qol')
  assert.deepEqual(client.inject, ['slots', 'locale', 'remote', 'remote.settings'])
  assert.equal(typeof client.apply, 'function')
  assert.equal(typeof client.compactionStatusCopy, 'function')
  assert.equal(typeof client.compactionStatusState, 'function')
})

test('compactionStatusCopy: the three wiring states', () => {
  const t = {
    compactionNotSet: 'not-set',
    compactionActive: 'active',
    compactionAvailable: 'available: {default}',
  }
  assert.equal(client.compactionStatusCopy(undefined, t), 'not-set')
  assert.equal(client.compactionStatusCopy({ presetGenerated: false, defaultPreset: 'standard' }, t), 'not-set')
  assert.equal(client.compactionStatusCopy({ presetGenerated: true, defaultPreset: 'qwen38' }, t), 'active')
  assert.equal(client.compactionStatusCopy({ presetGenerated: true, defaultPreset: 'standard' }, t), 'available: standard')
})

test('compactionStatusState: done active, warning available, idle not set up', () => {
  assert.equal(client.compactionStatusState(undefined), 'idle')
  assert.equal(client.compactionStatusState({ presetGenerated: false, defaultPreset: 'standard' }), 'idle')
  assert.equal(client.compactionStatusState({ presetGenerated: true, defaultPreset: 'qwen38' }), 'done')
  assert.equal(client.compactionStatusState({ presetGenerated: true, defaultPreset: 'standard' }), 'warning')
})

test('client: the load face reports the agent-presets default for the status actions', async () => {
  const { ctx } = fakeCtx()
  let captured = null
  ctx.slots.register = (option) => { captured = option.inject() }
  client.apply(ctx)
  const loaded = await captured.load()
  assert.equal(loaded.ok, true)
  assert.deepEqual(loaded.agentPresets, { revision: 3, defaultPreset: 'standard' })
})

test('client: registers one settings.section page with a localized label', () => {
  const { ctx } = fakeCtx()
  const options = []
  const components = []
  ctx.slots.inject = (name, callback) => {
    assert.equal(name, 'settings.section')
    callback()
  }
  ctx.slots.register = (option, component) => { options.push(option); components.push(component) }
  client.apply(ctx)
  assert.equal(options.length, 1)
  assert.equal(options[0].id, 'qwen38-local-qol')
  assert.equal(options[0].label(), 'Qwen3.8 本地')
  assert.equal(typeof components[0], 'function')
  // The inject face carries the locale hooks and the data callbacks.
  const face = options[0].inject()
  assert.equal(face.hooks.locale, ctx.locale)
  assert.equal(typeof face.load, 'function')
  assert.equal(typeof face.save, 'function')
})

test('client: the inject face loads the namespace view and writes with the held revision', async () => {
  const { ctx, updateCalls } = fakeCtx()
  let captured = null
  ctx.slots.register = (option) => { captured = option.inject() }
  client.apply(ctx)
  const loaded = await captured.load()
  assert.equal(loaded.ok, true)
  assert.equal(loaded.value.ns, 'qwen38-local-qol')
  assert.equal(loaded.value.revision, 7)

  const saved = await captured.save(loaded.value, { model: 'new-alias' })
  assert.equal(saved.ok, true)
  assert.equal(saved.value.revision, 8)
  assert.equal(updateCalls[0].ns, 'qwen38-local-qol')
  assert.equal(updateCalls[0].revision, 7)
  assert.equal(updateCalls[0].patch.model, 'new-alias')
})

test('client: a stale-revision write answers a conflict the caller can re-load', async () => {
  const { ctx, state } = fakeCtx({ conflictNext: true })
  let captured = null
  ctx.slots.register = (option) => { captured = option.inject() }
  client.apply(ctx)
  const loaded = await captured.load()
  // An external editor moves the namespace past the held revision.
  state.namespaces[0].revision = 9
  const saved = await captured.save(loaded.value, { model: 'stale-write' })
  assert.equal(saved.ok, false)
  assert.equal(saved.code, 'settings/conflict')
  const fresh = await captured.load()
  assert.equal(fresh.value.revision, 9)
})

test('toDraft: a fresh section (no user layer) ships the production defaults pre-filled', () => {
  const draft = client.toDraft({ dialect: 'ninfer', baseURL: 'http://localhost:8082/v1', model: 'qwen3.8-27b-nvfp4' })
  assert.equal(draft.contextWindow, '229376')
  assert.equal(draft.maxTokens, '24576')
  assert.equal(draft.low, '4096')
  assert.equal(draft.medium, '8192')
  assert.equal(draft.xhigh, '16384')
  assert.equal(draft.defaultBudget, '16384')
  assert.equal(draft.images, 'strip')
  assert.equal(draft.keepTurns, '5')
  assert.equal(draft.toolChars, '2000')
  // Legacy shape (no user.lines): the active line migrates from the top level.
  assert.equal(draft.baseURL, 'http://localhost:8082/v1')
  assert.equal(draft.model, 'qwen3.8-27b-nvfp4')
  // The top-level credential defaults to empty (keyless = no Authorization header).
  assert.equal(draft.apiKey, '')
  // The other lines park at their built-in defaults.
  assert.equal(draft.lines.llamacpp.baseURL, '')
  assert.equal(draft.lines.llamacpp.contextWindow, '229376')
  assert.equal(draft.lines.tabbyapi.baseURL, '')
  assert.equal(draft.lines.tabbyapi.contextWindow, '262144')
  assert.equal(draft.lines.tabbyapi.maxTokens, '57344')
  assert.equal(draft.lines.ninfer.xhigh, '16384')
})

test('toDraft: a new-shape section reads the active line from lines and parks the other', () => {
  const value = {
    dialect: 'llamacpp',
    baseURL: 'http://localhost:8080/v1',
    model: 'Huihui',
    user: { lines: { ninfer: {}, llamacpp: {} } },
    lines: {
      ninfer: { baseURL: 'http://localhost:8082/v1', model: 'qwen3.8-27b-nvfp4', displayName: 'N', contextWindow: 229376, maxTokens: 24576, thinkingBudgets: { low: 4096, medium: 8192, xhigh: 16384 }, defaultThinkingBudget: 8192, summarize: { images: 'keep', keepTurns: 3, toolChars: 1000 } },
      llamacpp: { baseURL: 'http://localhost:8080/v1', model: 'Huihui', displayName: 'L', contextWindow: 131072, maxTokens: 20480, thinkingBudgets: { low: 2048, medium: 4096, xhigh: 8192 }, defaultThinkingBudget: 32768 },
    },
  }
  const draft = client.toDraft(value)
  assert.equal(draft.dialect, 'llamacpp')
  assert.equal(draft.baseURL, 'http://localhost:8080/v1')
  assert.equal(draft.model, 'Huihui')
  assert.equal(draft.displayName, 'L')
  // The window numbers follow the line: active = llama line's smaller window.
  assert.equal(draft.contextWindow, '131072')
  assert.equal(draft.maxTokens, '20480')
  assert.equal(draft.low, '2048')
  assert.equal(draft.medium, '4096')
  assert.equal(draft.xhigh, '8192')
  // The thinking budget and trim knobs follow the line too: active = llama
  // line's own budget; its trim knobs fall back to the defaults (unset).
  assert.equal(draft.defaultBudget, '32768')
  assert.equal(draft.images, 'strip')
  assert.equal(draft.keepTurns, '5')
  assert.equal(draft.toolChars, '2000')
  // The parked NInfer line keeps its own numbers.
  assert.equal(draft.lines.ninfer.baseURL, 'http://localhost:8082/v1')
  assert.equal(draft.lines.ninfer.model, 'qwen3.8-27b-nvfp4')
  assert.equal(draft.lines.ninfer.displayName, 'N')
  assert.equal(draft.lines.ninfer.contextWindow, '229376')
  assert.equal(draft.lines.ninfer.maxTokens, '24576')
  assert.equal(draft.lines.ninfer.xhigh, '16384')
  assert.equal(draft.lines.ninfer.defaultThinkingBudget, '8192')
  assert.equal(draft.lines.ninfer.images, 'keep')
  assert.equal(draft.lines.ninfer.keepTurns, '3')
  assert.equal(draft.lines.ninfer.toolChars, '1000')
  // The unpersisted TabbyAPI line parks at its built-in 256K defaults.
  assert.equal(draft.lines.tabbyapi.baseURL, '')
  assert.equal(draft.lines.tabbyapi.contextWindow, '262144')
  assert.equal(draft.lines.tabbyapi.maxTokens, '57344')
})

test('toDraft: a stored top-level apiKey surfaces on the draft; absent keys stay empty', () => {
  const keyed = client.toDraft({ dialect: 'ninfer', apiKey: 'sk-stored' })
  assert.equal(keyed.apiKey, 'sk-stored')
  const keyless = client.toDraft({ dialect: 'ninfer' })
  assert.equal(keyless.apiKey, '')
})

test('toDraft: a tabbyapi-active section lifts the ExLlamaV3 line onto the inputs', () => {
  const value = {
    dialect: 'tabbyapi',
    baseURL: 'http://localhost:8083/v1',
    model: 'Qwen3.8-Flash-Next-4.05bpw',
    user: { lines: { tabbyapi: {} } },
    lines: {
      tabbyapi: { baseURL: 'http://localhost:8083/v1', model: 'Qwen3.8-Flash-Next-4.05bpw', displayName: 'F', contextWindow: 262144, maxTokens: 57344, thinkingBudgets: { low: 4096, medium: 8192, xhigh: 16384 } },
    },
  }
  const draft = client.toDraft(value)
  assert.equal(draft.dialect, 'tabbyapi')
  assert.equal(draft.baseURL, 'http://localhost:8083/v1')
  assert.equal(draft.model, 'Qwen3.8-Flash-Next-4.05bpw')
  assert.equal(draft.displayName, 'F')
  assert.equal(draft.contextWindow, '262144')
  assert.equal(draft.maxTokens, '57344')
  // The other lines park at their built-in defaults.
  assert.equal(draft.lines.ninfer.baseURL, '')
  assert.equal(draft.lines.llamacpp.baseURL, '')
})
