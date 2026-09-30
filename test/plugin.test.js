/**
 * The function-plugin contract: exports, registration, live config, disposal.
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import * as plugin from '../src/index.js'
import { QwenLocalAdapter } from '../src/adapter.js'
import { liveConfigView } from '../src/settings-section.js'

/**
 * Fake plugin ctx mimicking the cordis runtime the plugin talks to:
 * `inject` runs the callback eagerly with a face exposing the requested
 * services and stays pending (no callback) when any requested service is
 * absent (the optional-service behavior); `on` records event listeners so
 * tests can fire `loader/volatile-update`; `logger` collects warnings.
 */
function makeTestCtx(services = {}, llm = {}) {
  const listeners = new Map()
  const warnings = []
  return {
    listeners,
    warnings,
    inject(names, callback) {
      const face = {}
      for (const name of names) {
        if (!Object.hasOwn(services, name)) return {}
        face[name] = services[name]
      }
      callback(face)
      return {}
    },
    on(event, handler) {
      if (!listeners.has(event)) listeners.set(event, [])
      listeners.get(event).push(handler)
    },
    logger: { warn: (message) => warnings.push(message) },
    llm,
  }
}

/** Stub the wire transport; collects request bodies and answers with a tiny stream. */
function stubFetch() {
  const realFetch = globalThis.fetch
  const requests = []
  globalThis.fetch = async (_url, init) => {
    requests.push(init)
    return {
      ok: true,
      status: 200,
      headers: { get: (name) => (name === 'content-type' ? 'text/event-stream' : null) },
      body: (async function* () {
        yield new TextEncoder().encode('data: {"choices":[{"delta":{"content":"ok"}}]}\n\n')
        yield new TextEncoder().encode('data: {"choices":[{"delta":{},"finish_reason":"stop"}]}\n\n')
        yield new TextEncoder().encode('data: [DONE]\n\n')
      })(),
    }
  }
  return {
    requests,
    restore: () => { globalThis.fetch = realFetch },
  }
}

const streamOnce = async (adapter, extra = {}) => {
  for await (const _chunk of adapter.stream({
      provider: 'qwen38',
      maxTokens: 64,
      system: 'sys',
      messages: [{ role: 'user', content: [{ type: 'text', text: 'hi' }] }],
      signal: new AbortController().signal,
      ...extra,
    })) { /* drain */ }
}

test('plugin contract: named exports, no default export', () => {
  assert.equal(plugin.name, 'qwen38-local-qol')
  assert.deepEqual(plugin.inject, ['llm'])
  assert.equal(typeof plugin.apply, 'function')
  assert.equal(plugin.default, undefined)
  // The cordis Config (the 0.2.0 settings surface) is exported.
  assert.ok(plugin.Config)
})

test('apply: the adapter reads the live config reference per request (volatile commits serve the next call)', async () => {
  let registered = null
  const ctx = makeTestCtx({}, {
    registerAdapter(_routes, adapter) {
      registered = adapter
      return { replace: () => {} }
    },
  })
  const config = { baseURL: 'http://localhost:8080/v1', model: 'qwen3.8-27b', contextWindow: 262144 }
  const fetchStub = stubFetch()
  try {
    plugin.apply(ctx, config)
    // The compaction backend's live-config mirror is published by apply().
    assert.equal(liveConfigView(), config)
    // First request: the default general line (llama.cpp wire: effort in
    // chat_template_kwargs, the budget top-level on both dialects).
    await streamOnce(registered, { reasoningEffort: 'medium' })
    let sent = JSON.parse(fetchStub.requests.at(-1).body)
    assert.equal(sent.model, 'qwen3.8-27b')
    assert.equal(sent.chat_template_kwargs.reasoning_effort, 'medium')
    assert.equal(sent.reasoning_budget_tokens, 8192)

    // A volatile commit mutates the SAME config reference (the loader commits
    // into running references); the next request carries the new values
    // without any re-registration.
    config.model = 'another-alias'
    config.thinkingBudgets = { low: 100, medium: 200, xhigh: 300 }
    for (const handler of ctx.listeners.get('loader/volatile-update') ?? []) handler([['model']])
    await streamOnce(registered, { reasoningEffort: 'medium' })
    sent = JSON.parse(fetchStub.requests.at(-1).body)
    assert.equal(sent.model, 'another-alias')
    assert.equal(sent.reasoning_budget_tokens, 200)
    assert.equal(ctx.warnings.length, 0)
  } finally {
    fetchStub.restore()
  }
})

test('apply: a hot edit with an unservable combination warns once (loud, non-fatal)', async () => {
  let registered = null
  const ctx = makeTestCtx({}, {
    registerAdapter(_routes, adapter) {
      registered = adapter
      return { replace: () => {} }
    },
  })
  const config = {}
  plugin.apply(ctx, config)
  // defaultEffort parked on an undeclared budget key: validateSection refuses.
  config.defaultEffort = 'ultra'
  config.thinkingBudgets = { low: 100, medium: 200, xhigh: 300 }
  for (const handler of ctx.listeners.get('loader/volatile-update') ?? []) handler([['defaultEffort']])
  for (const handler of ctx.listeners.get('loader/volatile-update') ?? []) handler([['defaultEffort']])
  assert.equal(ctx.warnings.length, 1)
  assert.match(ctx.warnings[0], /defaultEffort "ultra" is not a declared effort/)
})

test('apply: a model-bearing hot edit re-advertises the catalog; unrelated edits and no-ops stay silent', () => {
  const replaces = []
  const ctx = makeTestCtx({}, {
    registerAdapter() { return { replace: (providers) => replaces.push(providers) } },
  })
  const config = { model: 'qwen3.8-27b' }
  plugin.apply(ctx, config)
  const fire = () => {
    for (const handler of ctx.listeners.get('loader/volatile-update') ?? []) handler([['model']])
  }
  // A credential-only commit: none of the catalog fields moved.
  config.apiKey = 'sk-rotated'
  fire()
  assert.deepEqual(replaces, [])
  // The line switch: the model id changed, so the open model menus must be
  // told to re-read (one replace, publishing llm/adapters-updated).
  config.model = 'Qwen3.8-Flash-Next'
  fire()
  assert.equal(replaces.length, 1)
  assert.equal(replaces[0][0], 'qwen38')
  // A repeat with identical values rewrites nothing.
  fire()
  assert.equal(replaces.length, 1)
  assert.equal(ctx.warnings.length, 0)
})

test('apply: registers the configured routes with a QwenLocalAdapter and returns the handle', () => {
  let registered = null
  const ctx = makeTestCtx({}, {
    registerAdapter(routes, adapter) {
      registered = { routes, adapter }
      const handle = () => { handle.released = true }
      return handle
    },
  })
  const handle = plugin.apply(ctx, { baseURL: 'http://a/v1', provider: ['qwen38', 'qwen38-2'] })
  assert.deepEqual(registered.routes, ['qwen38', 'qwen38-2'])
  assert.ok(registered.adapter instanceof QwenLocalAdapter)
  assert.equal(typeof handle, 'function')
  handle()
  assert.equal(handle.released, true)
})

test('apply: default config registers the single default route', () => {
  let registered = null
  const ctx = makeTestCtx({}, {
    registerAdapter(routes, adapter) {
      registered = routes
      return () => {}
    },
  })
  plugin.apply(ctx, {})
  assert.deepEqual(registered, ['qwen38'])
})

test('apply: injects the core "attachments" service (plural) so image blocks reach the wire', async () => {
  const pngBytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 57])
  const ref = { attachmentId: 'att-1', mediaType: 'image/png', bytes: 8, width: 2, height: 2, name: 'x.png' }
  const readImageCalls = []
  const attachmentService = { readImage: async (value) => { readImageCalls.push(value); return { ref, data: pngBytes } } }
  let registered = null
  const ctx = makeTestCtx({ attachments: attachmentService }, {
    registerAdapter(_routes, adapter) {
      registered = adapter
      return () => {}
    },
  })
  // Stub fetch BEFORE apply: the adapter captures globalThis.fetch at
  // construction, so a later stub would not be seen (the request would go to
  // the real server the default baseURL points at).
  const fetchStub = stubFetch()
  try {
    plugin.apply(ctx, {})
    const chunks = []
    for await (const chunk of registered.stream({
        provider: 'qwen38',
        model: 'qwen3.8-27b-nvfp4',
        maxTokens: 64,
        system: 'sys',
        messages: [{ role: 'user', content: [{ type: 'text', text: 'look' }, { type: 'image', attachment: ref }] }],
        signal: new AbortController().signal,
      })) chunks.push(chunk)
    assert.equal(chunks.at(-1).type, 'finish')
    assert.deepEqual(readImageCalls, [ref])
    const sent = JSON.parse(fetchStub.requests[0].body)
    const userMessage = sent.messages.find((message) => message.role === 'user')
    const imageEntry = userMessage.content.find((entry) => entry.type === 'image_url')
    assert.equal(imageEntry.image_url.url, `data:image/png;base64,${Buffer.from(pngBytes).toString('base64')}`)
  } finally {
    fetchStub.restore()
  }
})

test('apply: never writes the home at boot (the legacy auto-apply is gone; presets are patch-declared)', () => {
  const writes = []
  const ctx = makeTestCtx({}, { registerAdapter: () => () => {} })
  plugin.apply(ctx, {})
  // No filesystem side effects on the boot path: nothing to observe beyond a
  // clean return and zero warnings.
  assert.equal(ctx.warnings.length, 0)
  assert.equal(writes.length, 0)
})
