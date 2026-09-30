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
      ns: 'qwen38',
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
      ns: 'agent-preset-registry',
      revision: 3,
      value: { default: 'standard', selectedDefault: undefined },
    }, ...(overrides.defaultModel ? [{ ns: 'agent-default-model', revision: 1, value: overrides.defaultModel }] : [])],
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
            return { ok: false, error: { code: 'settings-conflict', message: 'stale revision' } }
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
  assert.equal(loaded.value.ns, 'qwen38')
  assert.equal(loaded.value.revision, 7)

  const saved = await captured.save(loaded.value, { model: 'new-alias' })
  assert.equal(saved.ok, true)
  assert.equal(saved.value.revision, 8)
  assert.equal(updateCalls[0].ns, 'qwen38')
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
  assert.equal(saved.code, 'settings-conflict')
  const fresh = await captured.load()
  assert.equal(fresh.value.revision, 9)
})

test('client: saving a line change repoints the official default-model row when it rides this provider', async () => {
  const { ctx, updateCalls, state } = fakeCtx({ defaultModel: { provider: 'qwen38', model: 'qwen3.8-27b', reasoningEffort: 'medium' } })
  let captured = null
  ctx.slots.register = (option) => { captured = option.inject() }
  client.apply(ctx)
  const loaded = await captured.load()
  const saved = await captured.save(loaded.value, { model: 'Qwen3.8-Flash-Next' })
  assert.equal(saved.ok, true)
  assert.equal(updateCalls.length, 2)
  assert.equal(updateCalls[1].ns, 'agent-default-model')
  assert.deepEqual(updateCalls[1].patch, { model: 'Qwen3.8-Flash-Next' })
  assert.equal(updateCalls[1].revision, 1)
  assert.equal(state.namespaces[2].value.model, 'Qwen3.8-Flash-Next')
  // Effort and provider ride untouched.
  assert.equal(state.namespaces[2].value.reasoningEffort, 'medium')
  assert.equal(state.namespaces[2].value.provider, 'qwen38')
})

test('client: the default-model sync never touches another provider pick or repeats an equal model', async () => {
  const { ctx, updateCalls } = fakeCtx({ defaultModel: { provider: 'deepseek', model: 'deepseek-v4-pro' } })
  let captured = null
  ctx.slots.register = (option) => { captured = option.inject() }
  client.apply(ctx)
  const loaded = await captured.load()
  await captured.save(loaded.value, { model: 'Qwen3.8-Flash-Next' })
  assert.equal(updateCalls.length, 1)
  assert.equal(updateCalls[0].ns, 'qwen38')
})

test('client: an already-matching default-model row is not rewritten (no-op write discipline)', async () => {
  const { ctx, updateCalls } = fakeCtx({ defaultModel: { provider: 'qwen38', model: 'Qwen3.8-Flash-Next' } })
  let captured = null
  ctx.slots.register = (option) => { captured = option.inject() }
  client.apply(ctx)
  const loaded = await captured.load()
  await captured.save(loaded.value, { model: 'Qwen3.8-Flash-Next' })
  assert.equal(updateCalls.length, 1)
  assert.equal(updateCalls[0].ns, 'qwen38')
})

test('toDraft: a fresh section (no user layer) ships the built-in starter defaults pre-filled', () => {
  const draft = client.toDraft({ dialect: 'ninfer', baseURL: 'http://localhost:8082/v1', model: 'qwen3.8-27b-nvfp4' })
  assert.equal(draft.contextWindow, '131072')
  assert.equal(draft.maxTokens, '16384')
  assert.equal(draft.low, '2048')
  assert.equal(draft.medium, '4096')
  assert.equal(draft.xhigh, '8192')
  assert.equal(draft.defaultBudget, '8192')
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
  assert.equal(draft.lines.llamacpp.contextWindow, '131072')
  assert.equal(draft.lines.tabbyapi.baseURL, '')
  assert.equal(draft.lines.tabbyapi.contextWindow, '131072')
  assert.equal(draft.lines.tabbyapi.maxTokens, '16384')
  assert.equal(draft.lines.omlx.baseURL, '')
  assert.equal(draft.lines.omlx.contextWindow, '131072')
  assert.equal(draft.lines.omlx.maxTokens, '16384')
  assert.equal(draft.lines.ninfer.xhigh, '8192')
  // The trigger point is shared across lines and ships at 80 percent.
  assert.equal(draft.compactPct, '80')
})

test('toDraft: a saved trigger percent rides the draft', () => {
  const draft = client.toDraft({ dialect: 'llamacpp', user: { lines: {} }, compactThresholdPct: 90 })
  assert.equal(draft.compactPct, '90')
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
  // The unpersisted TabbyAPI and oMLX lines park at their built-in defaults.
  assert.equal(draft.lines.tabbyapi.baseURL, '')
  assert.equal(draft.lines.tabbyapi.contextWindow, '131072')
  assert.equal(draft.lines.tabbyapi.maxTokens, '16384')
  assert.equal(draft.lines.omlx.baseURL, '')
  assert.equal(draft.lines.omlx.contextWindow, '131072')
  assert.equal(draft.lines.omlx.maxTokens, '16384')
})

test('toDraft: a stored top-level apiKey surfaces on the draft; absent keys stay empty', () => {
  const keyed = client.toDraft({ dialect: 'ninfer', apiKey: 'sk-stored' })
  assert.equal(keyed.apiKey, 'sk-stored')
  const keyless = client.toDraft({ dialect: 'ninfer' })
  assert.equal(keyless.apiKey, '')
})

test('toDraft: credentials are per-line — each line keeps its own key and the flat field mirrors the active line', () => {
  const value = {
    dialect: 'ninfer',
    user: { lines: {} },
    lines: {
      ninfer: { apiKey: 'sk-ninfer' },
      llamacpp: { apiKey: 'sk-llama' },
    },
  }
  const draft = client.toDraft(value)
  assert.equal(draft.apiKey, 'sk-ninfer')
  assert.equal(draft.lines.llamacpp.apiKey, 'sk-llama')
  assert.equal(draft.lines.tabbyapi.apiKey, '')
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
  assert.equal(draft.lines.omlx.baseURL, '')
})

test('toDraft: an omlx-active section lifts the MLX line onto the inputs', () => {
  const value = {
    dialect: 'omlx',
    baseURL: 'http://localhost:8000/v1',
    model: 'Qwen3.8-27B-MLX-8bit',
    user: { lines: { omlx: {} } },
    lines: {
      omlx: { baseURL: 'http://localhost:8000/v1', model: 'Qwen3.8-27B-MLX-8bit', displayName: 'MLX', contextWindow: 64000, maxTokens: 16384, thinkingBudgets: { low: 4096, medium: 8192, xhigh: 16384 } },
    },
  }
  const draft = client.toDraft(value)
  assert.equal(draft.dialect, 'omlx')
  assert.equal(draft.baseURL, 'http://localhost:8000/v1')
  assert.equal(draft.model, 'Qwen3.8-27B-MLX-8bit')
  assert.equal(draft.displayName, 'MLX')
  assert.equal(draft.contextWindow, '64000')
  assert.equal(draft.maxTokens, '16384')
  // The other lines park at their built-in defaults.
  assert.equal(draft.lines.ninfer.baseURL, '')
  assert.equal(draft.lines.llamacpp.baseURL, '')
  assert.equal(draft.lines.tabbyapi.baseURL, '')
})

test('compactionWallGuardTokens mirrors the backend linear guard', () => {
  // The guard is a quarter of the cap; a bigger cap earns a bigger guard.
  assert.equal(client.compactionWallGuardTokens(262144, 40960), 10240)
  assert.equal(client.compactionWallGuardTokens(262144, 104857), 26214)
  // Narrow line: a quarter of the remaining budget caps the guard.
  assert.equal(client.compactionWallGuardTokens(40000, 20000), 5000)
  assert.equal(client.compactionWallGuardTokens(65536, 57344), 2048)
  // Tiny caps keep the 1024 floor.
  assert.equal(client.compactionWallGuardTokens(262144, 2048), 1024)
  // Degenerate geometry falls back to the legacy floor.
  assert.equal(client.compactionWallGuardTokens(0, 0), 10000)
  assert.equal(client.compactionWallGuardTokens(20000, 20000), 10000)
})

test('compactionCapSync slides the output cap with the slider, both directions', () => {
  // Production geometry with xhigh 32768 (room 34,816): exact caps while the
  // point can land...
  assert.deepEqual(client.compactionCapSync(262144, 50, 32768), { cap: 104857, neededCap: 104857, red: false })
  assert.deepEqual(client.compactionCapSync(262144, 60, 32768), { cap: 83886, neededCap: 83886, red: false })
  assert.deepEqual(client.compactionCapSync(262144, 80, 32768), { cap: 41943, neededCap: 41943, red: false })
  assert.deepEqual(client.compactionCapSync(262144, 83, 32768), { cap: 35651, neededCap: 35651, red: false })
  // ...and park at the room, red, when the cap the point needs cuts into the
  // thinking budgets (84 needs 33,554 < 34,816).
  assert.deepEqual(client.compactionCapSync(262144, 84, 32768), { cap: 34816, neededCap: 33554, red: true })
  assert.deepEqual(client.compactionCapSync(262144, 90, 32768), { cap: 34816, neededCap: 20971, red: true })
  // Smaller budgets open the right end: with xhigh 8192 the room is 10,240,
  // so even 90 (needing 20,971) lands clean.
  assert.deepEqual(client.compactionCapSync(262144, 90, 8192), { cap: 20971, neededCap: 20971, red: false })
  // Small windows get small guards, and can still go red at the edge.
  assert.deepEqual(client.compactionCapSync(32768, 70, 4096), { cap: 7864, neededCap: 7864, red: false })
  assert.deepEqual(client.compactionCapSync(32768, 90, 4096), { cap: 6144, neededCap: 2621, red: true })
  // Out-of-band percent and broken geometry yield null.
  assert.equal(client.compactionCapSync(262144, 40, 32768), null)
  assert.equal(client.compactionCapSync(262144, 100, 32768), null)
  assert.equal(client.compactionCapSync(0, 80, 32768), null)
})
