/**
 * The adapter end-to-end against an in-memory fetch: stream translation,
 * error codes, model resolution, and the exact wire body per dialect.
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { QwenLocalAdapter } from '../src/adapter.js'

const CONFIG = {
  baseURL: 'http://local:8082/v1',
  model: 'qwen',
  apiKey: undefined,
  dialect: 'ninfer',
  contextWindow: 229376,
  maxTokens: 24576,
  thinkingBudgets: { low: 4096, medium: 8192, xhigh: 16384 },
  thinkingLevelMap: {},
  includeUsage: false,
}

const encoder = new TextEncoder()

/** Build a fake streaming (SSE) response from raw frame strings. */
function sseResponse(frames) {
  const body = (async function* () {
    for (const frame of frames) yield encoder.encode(frame)
  })()
  return {
    ok: true,
    status: 200,
    headers: { get: (name) => (name === 'content-type' ? 'text/event-stream' : null) },
    body,
    text: async () => frames.join(''),
  }
}

/** Build a fake non-streaming (JSON) response from a body object. */
function jsonResponse(body) {
  return {
    ok: true,
    status: 200,
    headers: { get: (name) => (name === 'content-type' ? 'application/json' : null) },
    body: null,
    json: async () => body,
    text: async () => JSON.stringify(body),
  }
}

/** A fake fetch capturing every request. */
function fakeFetch(response) {
  const requests = []
  const fetch = async (url, init) => {
    requests.push({ url, init })
    return response
  }
  return { fetch, requests }
}

const options = () => ({
  provider: 'qwen38',
  model: 'qwen',
  reasoningEffort: 'medium',
  maxTokens: 24576,
  system: 'sys',
  messages: [{ role: 'user', content: [{ type: 'text', text: 'hi' }] }],
  signal: new AbortController().signal,
})

test('stream: reasoning + text + usage with reasoning tokens, terminal finish', async () => {
  const frames = [
    'data: {"choices":[{"delta":{"reasoning_content":"r1"}}]}\n\n',
    'data: {"choices":[{"delta":{"reasoning_content":"r2"}}]}\n\n',
    'data: {"choices":[{"delta":{"content":"hello"}}]}\n\n',
    'data: {"choices":[{"delta":{"content":" world"}}]}\n\n',
    'data: {"choices":[{"delta":{},"finish_reason":"stop"}],"usage":{"prompt_tokens":12,"completion_tokens":40,"total_tokens":52,"completion_tokens_details":{"reasoning_tokens":30}}}\n\n',
    'data: [DONE]\n\n',
  ]
  const { fetch, requests } = fakeFetch(sseResponse(frames))
  const adapter = new QwenLocalAdapter({ ...CONFIG, fetch })
  const chunks = []
  for await (const chunk of adapter.stream(options())) chunks.push(chunk)

  const types = chunks.map((chunk) => `${chunk.type}:${chunk.index ?? ''}`)
  assert.deepEqual(types, ['block-start:0', 'reasoning-delta:0', 'reasoning-delta:0', 'block-start:1', 'text-delta:1', 'text-delta:1', 'block-end:0', 'block-end:1', 'usage:', 'finish:'])
  assert.deepEqual(chunks.find((c) => c.type === 'usage').usage,
    { inputTokens: 12, outputTokens: 40, totalTokens: 52, reasoningTokens: 30 })
  assert.deepEqual(chunks.at(-1), { type: 'finish', reason: { kind: 'stop' } })

  // The exact wire body: ninfer dialect — effort top-level, kwargs only enable_thinking,
  // and the selected level's hard budget on the request.
  assert.equal(requests.length, 1)
  assert.equal(requests[0].url, 'http://local:8082/v1/chat/completions')
  const sent = JSON.parse(requests[0].init.body)
  assert.equal(sent.reasoning_effort, 'medium')
  assert.deepEqual(sent.chat_template_kwargs, { enable_thinking: true })
  assert.equal(sent.reasoning_budget_tokens, 8192)
  assert.equal(sent.max_tokens, 24576)
  assert.equal(sent.stream, true)
  assert.equal(sent.model, 'qwen')
  assert.deepEqual(sent.messages[0], { role: 'system', content: 'sys' })
  assert.deepEqual(sent.messages[1], { role: 'user', content: 'hi' })
  // Headers: attribution merged, content-type set, no auth without an api key.
  assert.equal(requests[0].init.headers['content-type'], 'application/json')
  assert.equal(requests[0].init.headers.accept, 'text/event-stream')
  assert.ok(!('authorization' in requests[0].init.headers))
})

test('stream: llamacpp dialect — effort in kwargs, budget top-level, usage requested', async () => {
  const frames = [
    'data: {"choices":[{"delta":{"content":"ok"}}]}\n\n',
    'data: {"choices":[{"delta":{},"finish_reason":"length"}]}\n\n',
    'data: [DONE]\n\n',
  ]
  const { fetch, requests } = fakeFetch(sseResponse(frames))
  const adapter = new QwenLocalAdapter({ ...CONFIG, dialect: 'llamacpp', includeUsage: true, fetch })
  const chunks = []
  for await (const chunk of adapter.stream(options())) chunks.push(chunk)

  const sent = JSON.parse(requests[0].init.body)
  assert.ok(!('reasoning_effort' in sent))
  assert.deepEqual(sent.chat_template_kwargs, { enable_thinking: true, reasoning_effort: 'medium' })
  assert.equal(sent.reasoning_budget_tokens, 8192)
  assert.deepEqual(sent.stream_options, { include_usage: true })
  // length → max-tokens: a budget/truncation stop is not presented as complete.
  assert.deepEqual(chunks.at(-1).reason, { kind: 'max-tokens' })
})

test('stream: HTTP error surfaces with the stable code and status', async () => {
  const response = {
    ok: false,
    status: 400,
    headers: { get: () => 'text/plain' },
    text: async () => 'thinking_budget_capacity_insufficient',
    body: null,
  }
  const { fetch } = fakeFetch(response)
  const adapter = new QwenLocalAdapter({ ...CONFIG, fetch })
  await assert.rejects(
    (async () => { for await (const _ of adapter.stream(options())) { /* drain */ } })(),
    (error) => error.code === 'PROVIDER_HTTP_ERROR' && /HTTP 400/.test(error.message) && /thinking_budget_capacity_insufficient/.test(error.message),
  )
})

test('stream: transport failure surfaces as PROVIDER_UNREACHABLE; caller abort rethrows the cause', async () => {
  const boom = new Error('ECONNREFUSED')
  const failing = async () => { throw boom }
  const adapter = new QwenLocalAdapter({ ...CONFIG, fetch: failing })
  await assert.rejects(
    (async () => { for await (const _ of adapter.stream(options())) { /* drain */ } })(),
    (error) => error.code === 'PROVIDER_UNREACHABLE' && error.cause === boom,
  )

  const controller = new AbortController()
  controller.abort()
  const aborting = async () => { throw boom }
  const abortingAdapter = new QwenLocalAdapter({ ...CONFIG, fetch: aborting })
  const abortOptions = { ...options(), signal: controller.signal }
  await assert.rejects(
    (async () => { for await (const _ of abortingAdapter.stream(abortOptions)) { /* drain */ } })(),
    (error) => error === boom,
  )
})

test('stream: non-streaming JSON answer is translated to the same chunk sequence', async () => {
  const body = {
    choices: [{ message: { content: 'done', reasoning_content: 'thought' }, finish_reason: 'stop' }],
    usage: { prompt_tokens: 3, completion_tokens: 7 },
  }
  const { fetch } = fakeFetch(jsonResponse(body))
  const adapter = new QwenLocalAdapter({ ...CONFIG, fetch })
  const chunks = []
  for await (const chunk of adapter.stream(options())) chunks.push(chunk)
  const types = chunks.map((chunk) => chunk.type)
  assert.deepEqual(types, ['block-start', 'reasoning-delta', 'block-start', 'text-delta', 'block-end', 'block-end', 'usage', 'finish'])
  assert.deepEqual(chunks.at(-1).reason, { kind: 'stop' })
})

test('stream: an assistant image block is refused before any wire traffic', async () => {
  let called = false
  const fetch = async () => { called = true; return sseResponse([]) }
  const adapter = new QwenLocalAdapter({ ...CONFIG, fetch })
  const badOptions = {
    ...options(),
    messages: [{ role: 'assistant', content: [{ type: 'image', attachment: { name: 'x' } }] }],
  }
  await assert.rejects(
    (async () => { for await (const _ of adapter.stream(badOptions)) { /* drain */ } })(),
    (error) => error.code === 'UNSUPPORTED_CONTENT',
  )
  assert.equal(called, false)
})

test('stream: user image blocks resolve to image_url data URLs through the attachment service', async () => {
  const pngBytes = new Uint8Array([137, 80, 78, 73, 13, 10, 26, 10])
  const ref = { attachmentId: 'att-1', mediaType: 'image/png', bytes: 8, width: 2, height: 2, name: 'x.png' }
  const attachment = { readImage: async () => ({ ref, data: pngBytes }) }
  const frames = [
    'data: {"choices":[{"delta":{"content":"ok"}}]}\n\n',
    'data: {"choices":[{"delta":{},"finish_reason":"stop"}]}\n\n',
    'data: [DONE]\n\n',
  ]
  const { fetch, requests } = fakeFetch(sseResponse(frames))
  const adapter = new QwenLocalAdapter({ ...CONFIG, attachment, fetch })
  const imageOptions = {
    ...options(),
    messages: [{ role: 'user', content: [{ type: 'text', text: 'look' }, { type: 'image', attachment: ref }] }],
  }
  const chunks = []
  for await (const chunk of adapter.stream(imageOptions)) chunks.push(chunk)
  assert.equal(chunks.at(-1).type, 'finish')

  const sent = JSON.parse(requests[0].init.body)
  const userMessage = sent.messages.find((message) => message.role === 'user')
  const imageEntry = userMessage.content.find((entry) => entry.type === 'image_url')
  const expected = `data:image/png;base64,${Buffer.from(pngBytes).toString('base64')}`
  assert.deepEqual(imageEntry, { type: 'image_url', image_url: { url: expected } })
  assert.ok(userMessage.content.some((entry) => entry.type === 'text' && entry.text === 'look'))
})

test('stream: an unreadable image degrades to the placeholder, the request still goes out', async () => {
  const ref = { attachmentId: 'att-2', mediaType: 'image/png', bytes: 4, width: 1, height: 1, name: 'gone.png' }
  const attachment = { readImage: async () => { throw new Error('store churn') } }
  const frames = [
    'data: {"choices":[{"delta":{"content":"ok"}}]}\n\n',
    'data: {"choices":[{"delta":{},"finish_reason":"stop"}]}\n\n',
    'data: [DONE]\n\n',
  ]
  const { fetch, requests } = fakeFetch(sseResponse(frames))
  const adapter = new QwenLocalAdapter({ ...CONFIG, attachment, fetch })
  const imageOptions = {
    ...options(),
    messages: [{ role: 'user', content: [{ type: 'image', attachment: ref }] }],
  }
  const chunks = []
  for await (const chunk of adapter.stream(imageOptions)) chunks.push(chunk)
  assert.equal(chunks.at(-1).type, 'finish')
  const sent = JSON.parse(requests[0].init.body)
  const userMessage = sent.messages.find((message) => message.role === 'user')
  assert.equal(typeof userMessage.content, 'string')
  assert.ok(userMessage.content.includes('[image: gone.png 1x1]'))
})

test('resolveModel: context capacity and the effort vocabulary with budgets', async () => {
  const adapter = new QwenLocalAdapter(CONFIG)
  const info = await adapter.resolveModel('qwen38', 'qwen')
  assert.equal(info.provider, 'qwen38')
  assert.equal(info.id, 'qwen')
  assert.deepEqual(info.context, { contextWindow: 229376 })
  assert.equal(info.defaultMaxTokens, 24576)
  const ids = info.reasoning.efforts.map((effort) => effort.id)
  assert.deepEqual(ids, ['off', 'low', 'medium', 'xhigh'])
  const medium = info.reasoning.efforts.find((effort) => effort.id === 'medium')
  assert.equal(medium.budgetTokens, 8192)
})

test('listModels: the configured model with text+image input modalities', async () => {
  const adapter = new QwenLocalAdapter(CONFIG)
  assert.deepEqual(await adapter.listModels('qwen38'),
    [{ provider: 'qwen38', id: 'qwen', name: 'qwen', inputModalities: ['text', 'image'] }])
})

test('listModels: the display name separates the selector label from the wire id', async () => {
  const adapter = new QwenLocalAdapter({ ...CONFIG, displayName: 'Qwen3.8-27B' })
  const models = await adapter.listModels('qwen38')
  assert.equal(models[0].id, 'qwen')
  assert.equal(models[0].name, 'Qwen3.8-27B')
})

test('imageRequestPricing: the NInfer patch formula per occurrence, empty priced text', () => {
  const adapter = new QwenLocalAdapter(CONFIG)
  const images = [
    { attachmentId: 'a', mediaType: 'image/png', bytes: 10, width: 256, height: 256 },
    { attachmentId: 'b', mediaType: 'image/png', bytes: 20, width: 1024, height: 1024 },
    { attachmentId: 'c', mediaType: 'image/jpeg', bytes: 30, width: 2048, height: 1024 },
    { attachmentId: 'd', mediaType: 'image/png', bytes: 40, width: 100, height: 50 },
  ]
  const prices = adapter.imageRequestPricing('qwen38', 'qwen').priceImages(images)
  assert.deepEqual(
    prices.map((price) => price.visualTokens),
    [66, 1026, 2050, 10], // 256^2, 1024^2, 2048x1024, non-multiple ceil(100/32)*ceil(50/32)+2
  )
  assert.ok(prices.every((price) => price.text === ''))
})

test('imageRequestPricing: the llama.cpp line prices every image at the server clamp maximum', () => {
  const adapter = new QwenLocalAdapter({ ...CONFIG, dialect: 'llamacpp' })
  const prices = adapter.imageRequestPricing('qwen38', 'qwen').priceImages([
    { attachmentId: 'a', mediaType: 'image/png', bytes: 10, width: 64, height: 64 },
    { attachmentId: 'b', mediaType: 'image/jpeg', bytes: 20, width: 4096, height: 2160 },
  ])
  assert.deepEqual(
    prices.map((price) => [price.visualTokens, price.text]),
    [[1536, ''], [1536, '']],
  )
})
