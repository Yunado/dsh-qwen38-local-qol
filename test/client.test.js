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
        baseURL: 'http://127.0.0.1:8082/v1',
        model: 'qwen3.8-27b-nvfp4-uncensored',
        displayName: 'Qwen3.8-27B',
        apiKey: '',
        contextWindow: 229376,
        maxTokens: 24576,
        thinkingBudgets: { low: 4096, medium: 8192, xhigh: 16384 },
        defaultEffort: 'medium',
        thinkingLevelMap: {},
        includeUsage: true,
        summarize: { images: 'strip', keepTurns: 5, toolChars: 2000 },
      },
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
          if (overrides.conflictNext && revision !== state.namespaces[0].revision) {
            return { ok: false, error: { code: 'settings/conflict', message: 'stale revision' } }
          }
          state.namespaces[0] = { ns, revision: state.namespaces[0].revision + 1, value: { ...state.namespaces[0].value, ...patch } }
          return { ok: true, value: state.namespaces[0] }
        },
      },
    },
  }
  return { ctx, describeCalls, updateCalls, state, registrations: { list: [] } }
}

test('client contract: named exports for the function-plugin loader', () => {
  assert.equal(client.name, 'qwen38-local-qol')
  assert.deepEqual(client.inject, ['slots', 'locale'])
  assert.equal(typeof client.apply, 'function')
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
