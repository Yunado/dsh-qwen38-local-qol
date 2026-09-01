/**
 * Wire translation: the Qwen thinking dialect per server, message projection,
 * finish/usage mapping, SSE parsing, and the chunk translator.
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildQwenBody,
  toOpenAiMessages,
  toOpenAiTools,
  toFinishReason,
  toTokenUsage,
  createSseParser,
  createChunkTranslator,
  parseFrame,
  chunksFromCompletion,
  chatCompletionsUrl,
} from '../src/wire.js'

const NINFER = {
  dialect: 'ninfer',
  thinkingBudgets: { low: 4096, medium: 8192, xhigh: 16384 },
  thinkingLevelMap: {},
  includeUsage: false,
}
const LLAMACPP = {
  dialect: 'llamacpp',
  thinkingBudgets: { low: 4096, medium: 8192, xhigh: 16384 },
  thinkingLevelMap: { xhigh: 'high' },
  includeUsage: true,
}

test('chatCompletionsUrl: never doubles the /v1 prefix', () => {
  assert.equal(chatCompletionsUrl('http://h:8080/v1'), 'http://h:8080/v1/chat/completions')
  assert.equal(chatCompletionsUrl('http://h:8080/v1/'), 'http://h:8080/v1/chat/completions')
  assert.equal(chatCompletionsUrl('http://h:8080'), 'http://h:8080/chat/completions')
})

test('buildQwenBody: ninfer dialect — effort top-level, kwargs only enable_thinking', () => {
  const body = buildQwenBody(
    { model: 'qwen', reasoningEffort: 'medium', maxTokens: 24576, messages: [] },
    'qwen',
    NINFER,
  )
  assert.equal(body.reasoning_effort, 'medium')
  assert.deepEqual(body.chat_template_kwargs, { enable_thinking: true })
  assert.equal(body.reasoning_budget_tokens, 8192)
  assert.equal(body.max_tokens, 24576)
  assert.ok(!('stream_options' in body))
})

test('buildQwenBody: llamacpp dialect — effort in kwargs, level map applied, budget top-level', () => {
  const body = buildQwenBody(
    { model: 'qwen', reasoningEffort: 'xhigh', messages: [] },
    'qwen',
    LLAMACPP,
  )
  assert.ok(!('reasoning_effort' in body))
  assert.deepEqual(body.chat_template_kwargs, { enable_thinking: true, reasoning_effort: 'high' })
  assert.equal(body.reasoning_budget_tokens, 16384)
  assert.deepEqual(body.stream_options, { include_usage: true })
})

test('buildQwenBody: off — enable_thinking false, no effort, no budget (both dialects)', () => {
  for (const config of [NINFER, LLAMACPP]) {
    const body = buildQwenBody({ model: 'qwen', reasoningEffort: 'off', messages: [] }, 'qwen', config)
    assert.deepEqual(body.chat_template_kwargs, { enable_thinking: false })
    assert.ok(!('reasoning_effort' in body))
    assert.ok(!('reasoning_budget_tokens' in body))
  }
})

test('buildQwenBody: absent effort — thinking off, no budget', () => {
  const body = buildQwenBody({ model: 'qwen', messages: [] }, 'qwen', NINFER)
  assert.deepEqual(body.chat_template_kwargs, { enable_thinking: false })
  assert.ok(!('reasoning_budget_tokens' in body))
})

test('buildQwenBody: effort without a configured budget sends no budget field', () => {
  const config = { ...NINFER, thinkingBudgets: { low: 4096 } }
  const body = buildQwenBody({ model: 'qwen', reasoningEffort: 'medium', messages: [] }, 'qwen', config)
  assert.ok(!('reasoning_budget_tokens' in body))
})

test('buildQwenBody: model falls back to the configured id', () => {
  const body = buildQwenBody({ messages: [] }, 'qwen', NINFER)
  assert.equal(body.model, 'qwen')
})

test('toOpenAiMessages: system slot, text, assistant reasoning + tool calls, tool results', () => {
  const options = {
    system: 'sys',
    messages: [
      { role: 'user', content: [{ type: 'text', text: 'hi' }] },
      {
        role: 'assistant',
        content: [
          { type: 'reasoning', text: 'think' },
          { type: 'text', text: 'doing it' },
          { type: 'tool-call', id: 'call-1', name: 'read', arguments: '{"path":"a"}' },
        ],
      },
      { role: 'tool', content: [{ type: 'tool-result', toolCallId: 'call-1', content: [{ type: 'text', text: 'file body' }] }] },
    ],
  }
  const messages = toOpenAiMessages(options)
  assert.deepEqual(messages[0], { role: 'system', content: 'sys' })
  assert.deepEqual(messages[1], { role: 'user', content: 'hi' })
  const assistant = messages[2]
  assert.equal(assistant.role, 'assistant')
  assert.equal(assistant.reasoning_content, 'think')
  assert.equal(assistant.content, 'doing it')
  assert.deepEqual(assistant.tool_calls, [{ id: 'call-1', type: 'function', function: { name: 'read', arguments: '{"path":"a"}' } }])
  const tool = messages[3]
  assert.deepEqual(tool, { role: 'tool', tool_call_id: 'call-1', content: 'file body' })
})

test('toOpenAiMessages: user tool-result blocks ride as tool messages, error marker preserved', () => {
  const options = {
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: 'look' },
          { type: 'tool-result', toolCallId: 'c2', content: [{ type: 'text', text: 'boom' }], isError: true },
        ],
      },
    ],
  }
  const messages = toOpenAiMessages(options)
  assert.deepEqual(messages, [
    { role: 'user', content: 'look' },
    { role: 'tool', tool_call_id: 'c2', content: '[error] boom' },
  ])
})

test('toOpenAiMessages: assistant with only tool calls gets null content', () => {
  const options = {
    messages: [
      { role: 'assistant', content: [{ type: 'tool-call', id: 'x', name: 'f', arguments: '{}' }] },
    ],
  }
  assert.equal(toOpenAiMessages(options)[0].content, null)
})

test('toOpenAiTools: standard function array, undefined when empty', () => {
  assert.equal(toOpenAiTools(undefined), undefined)
  assert.deepEqual(toOpenAiTools([{ name: 't', description: 'd', parameters: { type: 'object' } }]),
    [{ type: 'function', function: { name: 't', description: 'd', parameters: { type: 'object' } } }])
})

test('toFinishReason: length is max-tokens, tool_calls maps, everything else stops', () => {
  assert.deepEqual(toFinishReason('length'), { kind: 'max-tokens' })
  assert.deepEqual(toFinishReason('tool_calls'), { kind: 'tool-calls' })
  assert.deepEqual(toFinishReason('stop'), { kind: 'stop' })
  assert.deepEqual(toFinishReason(undefined), { kind: 'stop' })
})

test('toTokenUsage: counts plus optional total and reasoning details', () => {
  assert.equal(toTokenUsage(undefined), undefined)
  assert.deepEqual(toTokenUsage({ prompt_tokens: 10, completion_tokens: 5 }),
    { inputTokens: 10, outputTokens: 5 })
  assert.deepEqual(
    toTokenUsage({ prompt_tokens: 10, completion_tokens: 5, total_tokens: 15, completion_tokens_details: { reasoning_tokens: 3 } }),
    { inputTokens: 10, outputTokens: 5, totalTokens: 15, reasoningTokens: 3 },
  )
})

test('SSE parser: splits across chunks, skips comments, honors [DONE]', () => {
  const parser = createSseParser()
  const payloads = [
    ...parser.push('data: {"a":1\n\n: comment\nda'),
    ...parser.push('ta: {"a":2}\n\ndata: [DONE]\n\n'),
    ...parser.flush(),
  ]
  assert.deepEqual(payloads, ['{"a":1', '{"a":2}', '[DONE]'])
})

test('translator: interleaved reasoning, text, tool call — stable indexes, usage, finish', () => {
  const translator = createChunkTranslator()
  const chunks = [
    ...translator.accept({ choices: [{ delta: { reasoning_content: 'r1' } }] }),
    ...translator.accept({ choices: [{ delta: { reasoning_content: 'r2' } }] }),
    ...translator.accept({ choices: [{ delta: { content: 'hello' } }] }),
    ...translator.accept({ choices: [{ delta: { tool_calls: [{ id: 'c1', function: { name: 'read', arguments: '{"p":' } }] } }] }),
    ...translator.accept({ choices: [{ delta: { tool_calls: [{ id: 'c1', function: { arguments: '"a"}' } }] } }] }),
    ...translator.accept({ choices: [{ delta: {}, finish_reason: 'tool_calls' }], usage: { prompt_tokens: 1, completion_tokens: 2 } }),
    ...translator.end(),
  ]
  const types = chunks.map((chunk) => `${chunk.type}:${chunk.index ?? ''}`)
  assert.deepEqual(types, [
    'block-start:0',
    'reasoning-delta:0',
    'reasoning-delta:0',
    'block-start:1',
    'text-delta:1',
    'block-start:2',
    'tool-call-delta:2',
    'tool-call-delta:2',
    'block-end:0',
    'block-end:1',
    'block-end:2',
    'usage:',
    'finish:',
  ])
  assert.deepEqual(chunks[0], { type: 'block-start', index: 0, blockType: 'reasoning' })
  assert.deepEqual(chunks.find((c) => c.type === 'block-end' && c.index === 0).block, { type: 'reasoning', text: 'r1r2' })
  assert.deepEqual(chunks.find((c) => c.type === 'block-end' && c.index === 1).block, { type: 'text', text: 'hello' })
  assert.deepEqual(chunks.find((c) => c.type === 'block-end' && c.index === 2).block,
    { type: 'tool-call', id: 'c1', name: 'read', arguments: '{"p":"a"}' })
  assert.deepEqual(chunks.find((c) => c.type === 'usage').usage, { inputTokens: 1, outputTokens: 2 })
  assert.deepEqual(chunks.at(-1), { type: 'finish', reason: { kind: 'tool-calls' } })
})

test('translator: reasoning tokens count into output usage when the server reports them', () => {
  const translator = createChunkTranslator()
  const chunks = [
    ...translator.accept({ choices: [{ delta: { content: 'ok' }, finish_reason: 'stop' }],
      usage: { prompt_tokens: 8, completion_tokens: 30, completion_tokens_details: { reasoning_tokens: 22 } } }),
    ...translator.end(),
  ]
  assert.deepEqual(chunks.find((c) => c.type === 'usage').usage, { inputTokens: 8, outputTokens: 30, reasoningTokens: 22 })
})

test('parseFrame: non-JSON fails with the protocol code; in-band error fails with the provider code', () => {
  assert.throws(() => parseFrame('not json'), (error) => error.code === 'PROVIDER_PROTOCOL_ERROR')
  assert.throws(() => parseFrame('{"error": {"message": "ctx full"}}'), (error) => error.code === 'PROVIDER_ERROR')
})

test('chunksFromCompletion: non-stream JSON answer with reasoning and tools', () => {
  const chunks = chunksFromCompletion({
    choices: [{
      message: { content: 'done', reasoning_content: 'thought', tool_calls: [{ id: 'z', function: { name: 'f', arguments: '{}' } }] },
      finish_reason: 'stop',
    }],
    usage: { prompt_tokens: 4, completion_tokens: 6 },
  })
  const ends = chunks.filter((c) => c.type === 'block-end').map((c) => c.block.type)
  assert.deepEqual(ends, ['reasoning', 'text', 'tool-call'])
  assert.deepEqual(chunks.at(-1).reason, { kind: 'stop' })
})
