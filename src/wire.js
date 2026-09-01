/**
 * Pure translation between the harness request/stream vocabulary and the
 * OpenAI-compatible wire format the local Qwen3.8 line speaks (llama-server
 * and NInfer serve, both `/v1/chat/completions`), plus the Qwen thinking
 * dialect: `chat_template_kwargs.enable_thinking` / `reasoning_effort`
 * placement and the per-request `reasoning_budget_tokens` hard cap.
 *
 * Nothing here does I/O, so every mapping decision is directly testable.
 *
 * @module dsh-qwen38-local-qol/wire
 */

/** A message content block this adapter cannot represent on the wire. */
export const UNSUPPORTED_CONTENT_CODE = 'UNSUPPORTED_CONTENT'

/** The server answered, but its stream framing or payload was not parseable. */
export const PROVIDER_PROTOCOL_ERROR_CODE = 'PROVIDER_PROTOCOL_ERROR'

/** The server reported a failure in-band (an SSE `error` payload). */
export const PROVIDER_ERROR_CODE = 'PROVIDER_ERROR'

/**
 * NInfer vision token cost for one image: one token per 32x32 pixel patch
 * plus two markers, a pure function of input resolution (measured on NInfer
 * 0.4.0/0.5.0: 256^2 = 66, 1024^2 = 1026, 2048x1024 = 2050).
 * @param width - image width in pixels.
 * @param height - image height in pixels.
 * @returns the visual token count.
 */
export function ninferVisionTokens(width, height) {
  return Math.ceil(width / 32) * Math.ceil(height / 32) + 2
}

/**
 * Build the chat-completions endpoint for a configured base URL. The default
 * base URL already ends in `/v1`, so the `/v1` is never added a second time.
 * @param baseURL - configured server base, with or without a trailing slash.
 * @returns the absolute URL to POST a chat completion to.
 */
export function chatCompletionsUrl(baseURL) {
  return `${String(baseURL).replace(/\/+$/, '')}/chat/completions`
}

/**
 * Headers for one provider request. Attribution is merged first so a caller
 * cannot accidentally drop it, and the credential is sent only when set.
 * @param attribution - the harness attribution header map (may be empty).
 * @param apiKey - the server `--api-key` value, when one is configured.
 * @returns lowercase header names ready for `fetch`.
 */
export function requestHeaders(attribution = {}, apiKey) {
  const headers = {
    ...attribution,
    'content-type': 'application/json',
    accept: 'text/event-stream',
  }
  if (apiKey) headers.authorization = `Bearer ${apiKey}`
  return headers
}

/**
 * Project one image block onto the wire as an `image_url` entry. The durable
 * attachment reference carries the display name, media type, and dimensions;
 * the data URL (or its placeholder) is supplied by the caller so this module
 * stays pure.
 * @param block - one harness image block.
 * @param dataUrl - the `data:<media>;base64,<...>` URL, or undefined.
 * @returns the wire content entry.
 */
function imageEntry(block, dataUrl) {
  if (dataUrl !== undefined) {
    return { type: 'image_url', image_url: { url: dataUrl } }
  }
  const { name, mediaType, width, height } = block.attachment ?? {}
  return { type: 'text', text: `[image: ${name ?? mediaType} ${width}x${height}]` }
}

/**
 * Flatten one harness message's content blocks onto the OpenAI wire.
 * @param message - one harness message.
 * @param imageDataUrls - map from block identity to data URL; blocks without
 *   an entry fall back to a text placeholder.
 * @returns the wire content (a string when only text is present).
 */
function messageContent(message, imageDataUrls = new Map()) {
  let text = ''
  const entries = []
  let hasMedia = false
  for (const block of message.content ?? []) {
    if (block.type === 'text') {
      text += block.text
      continue
    }
    if (block.type === 'image') {
      const entry = imageEntry(block, imageDataUrls.get(block))
      if (entry.type === 'image_url') hasMedia = true
      entries.push(entry)
      continue
    }
    if (block.type === 'tool-result') {
      // Tool results ride as dedicated `tool` messages, collected by the caller.
      continue
    }
    if (block.type === 'reasoning' || block.type === 'tool-call') {
      // Assistant-side blocks; handled by the assistant projection.
      continue
    }
    throw new Error(
      `dsh-qwen38-local-qol: cannot send a "${block.type}" content block; `
      + 'this adapter supports text, image, tool-result, reasoning, and tool-call',
    )
  }
  if (entries.length === 0) return text
  if (!hasMedia) {
    // No resolvable media: every entry is text (placeholders), so the content
    // flattens to a string and the image information survives.
    return [text, ...entries.map((entry) => entry.text)].filter((part) => part !== '').join('')
  }
  if (text !== '') entries.unshift({ type: 'text', text })
  return entries
}

/**
 * Collect the `tool` wire messages carried by one user message's tool-result
 * blocks (a user message may carry several parallel results).
 * @param message - one harness user message.
 * @returns wire tool messages in block order.
 */
function toolResultMessages(message) {
  const out = []
  for (const block of message.content ?? []) {
    if (block.type !== 'tool-result') continue
    let text = ''
    for (const inner of block.content ?? []) {
      if (inner.type === 'text') text += inner.text
    }
    out.push({
      role: 'tool',
      tool_call_id: block.toolCallId,
      content: block.isError ? `[error] ${text}` : text,
    })
  }
  return out
}

/**
 * Map the harness conversation to OpenAI messages. `options.system` is
 * prepended as the system slot. Assistant reasoning blocks ride the standard
 * `reasoning_content` field (the #1198 hardening default: signature-less
 * thinking blocks are not silently dropped), and tool calls ride `tool_calls`.
 * @param options - the assembled {@link GenerateOptions}.
 * @param imageDataUrls - map from (messageIndex, blockIndex) to data URL.
 * @returns wire messages in conversation order.
 */
export function toOpenAiMessages(options, imageDataUrls = new Map()) {
  const messages = []
  if (options.system) messages.push({ role: 'system', content: options.system })
  const source = options.messages ?? []
  for (const [index, message] of source.entries()) {
    if (message.role === 'assistant') {
      let text = ''
      let reasoning = ''
      const toolCalls = []
      for (const block of message.content ?? []) {
        if (block.type === 'text') text += block.text
        else if (block.type === 'reasoning') reasoning += block.text
        else if (block.type === 'tool-call') toolCalls.push(block)
        else if (block.type === 'image') text += `[image: ${(block.attachment ?? {}).name ?? ''}]`
      }
      const wire = { role: 'assistant' }
      wire.content = text === '' && toolCalls.length > 0 ? null : text
      if (reasoning !== '') wire.reasoning_content = reasoning
      if (toolCalls.length > 0) {
        wire.tool_calls = toolCalls.map((block, i) => ({
          id: block.id,
          type: 'function',
          function: { name: block.name, arguments: block.arguments },
        }))
      }
      messages.push(wire)
      continue
    }
    if (message.role === 'tool') {
      const tools = toolResultMessages(message)
      if (tools.length === 0) messages.push({ role: message.role, content: '' })
      else messages.push(...tools)
      continue
    }
    // user (and any unknown role falls through to the plain projection)
    const tools = toolResultMessages(message)
    const content = messageContent(message, imageDataUrls)
    if (content !== '' || tools.length === 0) messages.push({ role: message.role, content })
    messages.push(...tools)
  }
  return messages
}

/**
 * Map harness tool schemas to the OpenAI `tools` array.
 * @param tools - schemas from {@link GenerateOptions.tools}.
 * @returns the wire tools array, or undefined when none were requested.
 */
export function toOpenAiTools(tools) {
  if (!tools?.length) return undefined
  return tools.map((tool) => ({
    type: 'function',
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    },
  }))
}

/**
 * Build the streaming chat-completion request body for the Qwen3.8 local
 * line, applying the thinking dialect of the configured server:
 *
 * - both dialects: `chat_template_kwargs.enable_thinking` carries the
 *   per-request thinking toggle (this llama.cpp build reads the toggle only
 *   from `chat_template_kwargs`; NInfer accepts it in its kwargs whitelist).
 * - `ninfer`: effort travels as the top-level `reasoning_effort` body field
 *   (its kwargs whitelist rejects any other key).
 * - `llamacpp`: effort travels as `chat_template_kwargs.reasoning_effort`
 *   (froggeric v22.1 template) and the selected level's hard thinking budget
 *   as the top-level `reasoning_budget_tokens` (per-request value overrides
 *   any `--reasoning-budget` CLI flag).
 *
 * `maxTokens` maps to `max_tokens`: the local servers do not read
 * `max_completion_tokens`.
 * @param options - the assembled {@link GenerateOptions}.
 * @param fallbackModel - configured model id, used when the request omits one.
 * @param config - resolved plugin config (dialect, budgets, level map).
 * @param imageDataUrls - map from image block to its `data:` URL (when the
 *   attachment service resolved the bytes); blocks without an entry degrade
 *   to a text placeholder.
 * @returns the JSON body to POST.
 */
export function buildQwenBody(options, fallbackModel, config, imageDataUrls) {
  const body = {
    model: options.model || fallbackModel,
    messages: toOpenAiMessages(options, imageDataUrls),
    stream: true,
  }
  const tools = toOpenAiTools(options.tools)
  if (tools) body.tools = tools
  if (options.temperature !== undefined) body.temperature = options.temperature
  if (options.maxTokens !== undefined) body.max_tokens = options.maxTokens
  if (options.stop?.length) body.stop = [...options.stop]
  if (config.includeUsage) body.stream_options = { include_usage: true }

  // Qwen thinking dialect. `reasoningEffort` is the adapter-owned branded id;
  // `off` (or absent) disables thinking for the request.
  const effort = typeof options.reasoningEffort === 'string' ? options.reasoningEffort : undefined
  const thinkingOn = effort !== undefined && effort !== 'off'
  const kwargs = { enable_thinking: thinkingOn }
  if (thinkingOn) {
    const wireEffort = config.thinkingLevelMap?.[effort] ?? effort
    if (config.dialect === 'ninfer') {
      body.reasoning_effort = wireEffort
    } else {
      kwargs.reasoning_effort = wireEffort
    }
  }
  body.chat_template_kwargs = kwargs

  const budget = thinkingOn ? config.thinkingBudgets?.[effort] : undefined
  if (typeof budget === 'number') body.reasoning_budget_tokens = budget

  return body
}

/**
 * Map an OpenAI `finish_reason` to the harness finish vocabulary. `length` is
 * reported as `max-tokens` rather than `stop`, so a truncated answer (including
 * a thinking budget exhaustion that lands on the output cap) is not presented
 * as a complete one.
 * @param reason - the provider's `finish_reason`, if it sent one.
 * @returns the harness {@link FinishReason}.
 */
export function toFinishReason(reason) {
  if (reason === 'tool_calls') return { kind: 'tool-calls' }
  if (reason === 'length') return { kind: 'max-tokens' }
  return { kind: 'stop' }
}

/**
 * Map an OpenAI usage object to harness {@link TokenUsage}. The local Qwen
 * line reports `completion_tokens_details.reasoning_tokens` when the server
 * patch is active (llama.cpp reasoning-budget build); the field is optional
 * everywhere else, so its absence degrades to plain counts.
 * @param usage - the provider's `usage` object, if it sent one.
 * @returns harness usage, or undefined when the counts are absent.
 */
export function toTokenUsage(usage) {
  if (!usage) return undefined
  const inputTokens = usage.prompt_tokens
  const outputTokens = usage.completion_tokens
  if (typeof inputTokens !== 'number' && typeof outputTokens !== 'number') return undefined
  const out = { inputTokens: inputTokens ?? 0, outputTokens: outputTokens ?? 0 }
  if (typeof usage.total_tokens === 'number') out.totalTokens = usage.total_tokens
  const reasoning = usage.completion_tokens_details?.reasoning_tokens
  if (typeof reasoning === 'number') out.reasoningTokens = reasoning
  return out
}

/**
 * Incremental SSE framing. Feed it decoded response text; it returns the
 * `data:` payloads of every event completed so far, in order.
 * @returns a parser with `push(text)` and `flush()`.
 */
export function createSseParser() {
  let buffer = ''
  let data = []
  const payloads = []

  const dispatch = () => {
    if (data.length === 0) return
    payloads.push(data.join('\n'))
    data = []
  }

  const consume = (line) => {
    if (line === '') {
      dispatch()
      return
    }
    if (line.startsWith(':')) return
    const colon = line.indexOf(':')
    const field = colon === -1 ? line : line.slice(0, colon)
    if (field !== 'data') return
    const value = colon === -1 ? '' : line.slice(colon + 1)
    data.push(value.startsWith(' ') ? value.slice(1) : value)
  }

  return {
    /**
     * Accept the next decoded chunk of the response body.
     * @param text - decoded bytes, split anywhere.
     * @returns complete event payloads, in arrival order.
     */
    push(text) {
      buffer += text
      let index
      while ((index = buffer.indexOf('\n')) !== -1) {
        const line = buffer.slice(0, index).replace(/\r$/, '')
        buffer = buffer.slice(index + 1)
        consume(line)
      }
      return payloads.splice(0, payloads.length)
    },
    /**
     * Close the stream, dispatching any event the server left unterminated.
     * @returns the remaining event payloads.
     */
    flush() {
      if (buffer.length > 0) {
        consume(buffer.replace(/\r$/, ''))
        buffer = ''
      }
      dispatch()
      return payloads.splice(0, payloads.length)
    },
  }
}

/**
 * Assemble harness {@link StreamChunk}s from OpenAI chat-completion frames,
 * extended from the text-only baseline with reasoning deltas
 * (`delta.reasoning_content`) and tool-call deltas (`delta.tool_calls`).
 *
 * Block indexes are assigned in first-seen order, so interleaved reasoning,
 * text, and tool-call blocks each keep a stable index. The emitted sequence
 * per response is: `block-start` per opened block, the deltas, one `block-end`
 * per block carrying the assembled block, `usage` when the server reported
 * any, then a terminal `finish`.
 * @returns a translator with `accept(payload)` and `end()`.
 */
export function createChunkTranslator() {
  /** @type {Map<number, { type: string, text?: string, id?: string, name?: string, args?: string }>} */
  const blocks = new Map()
  let nextIndex = 0
  let usage
  let finishReason

  const open = (blockType) => {
    const index = nextIndex++
    blocks.set(index, { type: blockType })
    return index
  }

  const ensure = (type, id) => {
    for (const [index, block] of blocks) {
      if (block.type === type && (type !== 'tool-call' || block.id === id)) return index
    }
    return open(type)
  }

  return {
    /**
     * Translate one decoded streaming frame.
     * @param frame - a parsed `chat.completion.chunk` object.
     * @returns the chunks this frame produced.
     */
    accept(frame) {
      const chunks = []
      const usageUpdate = toTokenUsage(frame?.usage)
      if (usageUpdate) usage = usageUpdate
      const choice = frame?.choices?.[0]
      if (!choice) return chunks
      if (choice.finish_reason) finishReason = choice.finish_reason
      const delta = choice.delta

      if (delta?.reasoning_content) {
        const index = ensure('reasoning')
        const block = blocks.get(index)
        if (!block.seen) {
          chunks.push({ type: 'block-start', index, blockType: 'reasoning' })
          block.seen = true
        }
        block.text = (block.text ?? '') + delta.reasoning_content
        chunks.push({ type: 'reasoning-delta', index, text: delta.reasoning_content })
      }

      if (typeof delta?.content === 'string' && delta.content.length > 0) {
        const index = ensure('text')
        const block = blocks.get(index)
        if (!block.seen) {
          chunks.push({ type: 'block-start', index, blockType: 'text' })
          block.seen = true
        }
        block.text = (block.text ?? '') + delta.content
        chunks.push({ type: 'text-delta', index, text: delta.content })
      }

      if (Array.isArray(delta?.tool_calls)) {
        for (const call of delta.tool_calls) {
          const id = call.id ?? ''
          const index = ensure('tool-call', id)
          const block = blocks.get(index)
          block.id = block.id ?? id
          if (call.function?.name) block.name = call.function.name
          if (!block.seen) {
            chunks.push({ type: 'block-start', index, blockType: 'tool-call' })
            block.seen = true
          }
          const argumentsDelta = call.function?.arguments ?? ''
          if (argumentsDelta !== '') {
            block.args = (block.args ?? '') + argumentsDelta
            chunks.push({ type: 'tool-call-delta', index, id: block.id, name: call.function?.name, argumentsDelta })
          }
        }
      }

      return chunks
    },

    /**
     * Close the response.
     * @returns the trailing `block-end`s, `usage`, and `finish` chunks.
     */
    end() {
      const chunks = []
      for (const [index, block] of blocks) {
        if (block.type === 'reasoning') {
          chunks.push({ type: 'block-end', index, block: { type: 'reasoning', text: block.text ?? '' } })
        } else if (block.type === 'text') {
          chunks.push({ type: 'block-end', index, block: { type: 'text', text: block.text ?? '' } })
        } else {
          chunks.push({
            type: 'block-end',
            index,
            block: { type: 'tool-call', id: block.id ?? '', name: block.name ?? '', arguments: block.args ?? '' },
          })
        }
      }
      if (usage) chunks.push({ type: 'usage', usage })
      chunks.push({ type: 'finish', reason: toFinishReason(finishReason) })
      return chunks
    },
  }
}

/**
 * Decode one SSE payload, failing loud on anything that is not a frame.
 * @param payload - the raw `data:` value, excluding the `[DONE]` sentinel.
 * @returns the parsed frame.
 */
export function parseFrame(payload) {
  let frame
  try {
    frame = JSON.parse(payload)
  } catch (cause) {
    const error = new Error(`dsh-qwen38-local-qol: server sent a stream frame that is not JSON: ${cause.message}`)
    error.code = PROVIDER_PROTOCOL_ERROR_CODE
    error.cause = cause
    throw error
  }
  assertNoProviderError(frame)
  return frame
}

/**
 * Reject a payload in which the server reported its own failure in-band.
 * @param frame - a decoded response or stream frame.
 */
export function assertNoProviderError(frame) {
  const error = frame?.error
  if (!error) return
  const message = typeof error === 'string' ? error : (error.message ?? JSON.stringify(error))
  const failure = new Error(`dsh-qwen38-local-qol: server reported an error: ${message}`)
  failure.code = PROVIDER_ERROR_CODE
  throw failure
}

/**
 * Translate a non-streaming `chat.completion` response into the same chunk
 * sequence a stream would have produced. Some local builds and proxies
 * ignore `stream: true` and answer with one JSON object.
 * @param response - the decoded `chat.completion` body.
 * @returns the full chunk sequence, terminal `finish` last.
 */
export function chunksFromCompletion(response) {
  assertNoProviderError(response)
  const translator = createChunkTranslator()
  const choice = response?.choices?.[0]
  const message = choice?.message ?? {}
  const chunks = translator.accept({
    choices: [{
      delta: {
        ...(message.reasoning_content ? { reasoning_content: message.reasoning_content } : {}),
        content: message.content ?? '',
        ...(Array.isArray(message.tool_calls)
          ? {
            tool_calls: message.tool_calls.map((call) => ({
              id: call.id ?? '',
              function: { name: call.function?.name, arguments: call.function?.arguments ?? '' },
            })),
          }
          : {}),
      },
      finish_reason: choice?.finish_reason,
    }],
    usage: response?.usage,
  })
  return [...chunks, ...translator.end()]
}
