/**
 * The function-plugin contract: exports, registration, and disposal.
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import * as plugin from '../src/index.js'
import { QwenLocalAdapter } from '../src/adapter.js'

test('plugin contract: named exports, no default export', () => {
  assert.equal(plugin.name, 'qwen38-local-qol')
  assert.deepEqual(plugin.inject, ['llm'])
  assert.equal(typeof plugin.apply, 'function')
  assert.equal(plugin.default, undefined)
})

test('apply: installs the user-settings section; the adapter reads the live resolved value', async () => {
  let registered = null
  let installCalls = []
  const ctx = {
    get: (name) => {
      if (name !== 'settings') return undefined
      return {
        installSection(_owner, ns, _schema, entry, hooks) {
          let value = entry
          installCalls.push({
            ns,
            entry,
            setValue: (next) => { value = next },
          })
          hooks.setSource(() => value)
          return () => {}
        },
      }
    },
    llm: {
      registerAdapter(_routes, adapter) {
        registered = adapter
        return () => {}
      },
    },
  }
  const frames = [
    'data: {"choices":[{"delta":{"content":"ok"}}]}\n\n',
    'data: {"choices":[{"delta":{},"finish_reason":"stop"}]}\n\n',
    'data: [DONE]\n\n',
  ]
  const realFetch = globalThis.fetch
  const requests = []
  globalThis.fetch = async (_url, init) => {
    requests.push(init)
    return {
      ok: true,
      status: 200,
      headers: { get: (name) => (name === 'content-type' ? 'text/event-stream' : null) },
      body: (async function* () {
        for (const frame of frames) yield new TextEncoder().encode(frame)
      })(),
    }
  }
  const streamOnce = async (reasoningEffort) => {
    const chunks = []
    // No request-level `model`: the wire model rides the config fallback
    // (`options.model || fallbackModel`), which is what the live settings
    // value moves.
    for await (const chunk of registered.stream({
        provider: 'qwen38',
        maxTokens: 64,
        system: 'sys',
        messages: [{ role: 'user', content: [{ type: 'text', text: 'hi' }] }],
        ...(reasoningEffort !== undefined ? { reasoningEffort } : {}),
        signal: new AbortController().signal,
      })) chunks.push(chunk)
    return JSON.parse(requests.at(-1).body)
  }
  try {
    plugin.apply(ctx, {})
    assert.equal(installCalls.length, 1)
    assert.equal(installCalls[0].ns, 'qwen38-local-qol')
    // The base is the fully resolved row (every field present), not the raw config.
    assert.equal(installCalls[0].entry.model, 'qwen3.8-27b-nvfp4-uncensored')
    assert.equal(installCalls[0].entry.contextWindow, 229376)

    // First request: the default production line (budgets from the resolved config).
    let sent = await streamOnce('medium')
    assert.equal(sent.model, 'qwen3.8-27b-nvfp4-uncensored')
    assert.equal(sent.reasoning_effort, 'medium')
    assert.equal(sent.reasoning_budget_tokens, 8192)

    // A settings change lands in the live source; the next request carries it.
    installCalls[0].setValue({
      ...installCalls[0].entry,
      model: 'another-alias',
      thinkingBudgets: { low: 100, medium: 200, xhigh: 300 },
    })
    sent = await streamOnce('medium')
    assert.equal(sent.model, 'another-alias')
    assert.equal(sent.reasoning_budget_tokens, 200)
  } finally {
    globalThis.fetch = realFetch
  }
})

test('apply: registers the configured routes with a QwenLocalAdapter and returns the handle', () => {
  let registered = null
  const ctx = {
    llm: {
      registerAdapter(routes, adapter) {
        registered = { routes, adapter }
        const handle = () => { handle.released = true }
        return handle
      },
    },
  }
  const handle = plugin.apply(ctx, { baseURL: 'http://a/v1', provider: ['qwen38', 'qwen38-2'] })
  assert.deepEqual(registered.routes, ['qwen38', 'qwen38-2'])
  assert.ok(registered.adapter instanceof QwenLocalAdapter)
  assert.equal(typeof handle, 'function')
  handle()
  assert.equal(handle.released, true)
})

test('apply: default config registers the single default route', () => {
  let registered = null
  const ctx = {
    llm: {
      registerAdapter(routes, adapter) {
        registered = routes
        return () => {}
      },
    },
  }
  plugin.apply(ctx, {})
  assert.deepEqual(registered, ['qwen38'])
})

test('apply: injects the core "attachments" service (plural) so image blocks reach the wire', async () => {
  const pngBytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 57])
  const ref = { attachmentId: 'att-1', mediaType: 'image/png', bytes: 8, width: 2, height: 2, name: 'x.png' }
  const readImageCalls = []
  const attachmentService = { readImage: async (value) => { readImageCalls.push(value); return { ref, data: pngBytes } } }
  let registered = null
  const ctx = {
    get: (name) => (name === 'attachments' ? attachmentService : undefined),
    llm: {
      registerAdapter(_routes, adapter) {
        registered = adapter
        return () => {}
      },
    },
  }
  const frames = [
    'data: {"choices":[{"delta":{"content":"ok"}}]}\n\n',
    'data: {"choices":[{"delta":{},"finish_reason":"stop"}]}\n\n',
    'data: [DONE]\n\n',
  ]
  // Stub fetch BEFORE apply: the adapter captures globalThis.fetch at
  // construction, so a later stub would not be seen (the request would go to
  // the real server the default baseURL points at).
  const realFetch = globalThis.fetch
  const requests = []
  globalThis.fetch = async (_url, init) => {
    requests.push(init)
    return {
      ok: true,
      status: 200,
      headers: { get: (name) => (name === 'content-type' ? 'text/event-stream' : null) },
      body: (async function* () {
        for (const frame of frames) yield new TextEncoder().encode(frame)
      })(),
    }
  }
  try {
    plugin.apply(ctx, {})
    const chunks = []
    for await (const chunk of registered.stream({
        provider: 'qwen38',
        model: 'qwen3.8-27b-nvfp4-uncensored',
        maxTokens: 64,
        system: 'sys',
        messages: [{ role: 'user', content: [{ type: 'text', text: 'look' }, { type: 'image', attachment: ref }] }],
        signal: new AbortController().signal,
      })) chunks.push(chunk)
    assert.equal(chunks.at(-1).type, 'finish')
    assert.deepEqual(readImageCalls, [ref])
    const sent = JSON.parse(requests[0].body)
    const userMessage = sent.messages.find((message) => message.role === 'user')
    const imageEntry = userMessage.content.find((entry) => entry.type === 'image_url')
    assert.equal(imageEntry.image_url.url, `data:image/png;base64,${Buffer.from(pngBytes).toString('base64')}`)
  } finally {
    globalThis.fetch = realFetch
  }
})
