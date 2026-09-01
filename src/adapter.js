/**
 * The Qwen3.8 local-line adapter: one HTTP request per model call against a
 * local server's OpenAI-compatible `/chat/completions` endpoint (llama-server
 * or NInfer serve), translated into the harness stream vocabulary with the
 * Qwen thinking dialect (per-request effort + hard thinking budget) and
 * reasoning-token usage.
 *
 * @module dsh-qwen38-local-qol/adapter
 */
import { LlmAdapter, LlmError, attributionHeaders, errorChain } from '@deepseek-ai/dsh-llm'
import {
  chatCompletionsUrl,
  chunksFromCompletion,
  createChunkTranslator,
  createSseParser,
  buildQwenBody,
  ninferVisionTokens,
  parseFrame,
  requestHeaders,
  UNSUPPORTED_CONTENT_CODE,
  PROVIDER_PROTOCOL_ERROR_CODE,
  PROVIDER_ERROR_CODE,
} from './wire.js'

/** The server could not be reached at all (refused, DNS failure, reset). */
export const PROVIDER_UNREACHABLE_CODE = 'PROVIDER_UNREACHABLE'

/** The server answered with a non-2xx status. */
export const PROVIDER_HTTP_ERROR_CODE = 'PROVIDER_HTTP_ERROR'

/** Human-readable provider name reported for every route this adapter owns. */
export const PROVIDER_NAME = 'Qwen3.8 local'

/** How much of an error body is quoted back in the failure message. */
const MAX_ERROR_BODY_CHARS = 500

/**
 * Conservative visual-token estimate for one image on the llama.cpp line:
 * the server resizes into its `--image-min-tokens`/`--image-max-tokens`
 * window (1024–1536 in the production bat), so the clamp maximum is the
 * safe upper bound for the token meter.
 */
const LLMACPP_IMAGE_TOKEN_CAP = 1536

/**
 * Adapter for the local Qwen3.8 line. It owns no credentials store, no model
 * catalog beyond the configured model, and no retry policy: the harness
 * supplies those. Every failure surfaces as an {@link LlmError} with a stable
 * code rather than an empty stream.
 */
export class QwenLocalAdapter extends LlmAdapter {
  #baseURL
  #model
  #displayName
  #apiKey
  #attachment
  #config
  #fetch

  /**
   * @param config - resolved configuration from `resolveConfig()` (or a test double).
   * @param config.baseURL - server base URL, including `/v1`.
   * @param config.model - model id to send when a request omits one.
   * @param config.displayName - selector name shown in the GUI; falls back to the model id.
   * @param config.apiKey - optional server `--api-key` credential.
   * @param config.dialect - `ninfer` or `llamacpp`; selects the thinking wire.
   * @param config.contextWindow - declared context capacity for pressure compaction.
   * @param config.maxTokens - declared per-request output cap.
   * @param config.thinkingBudgets - per-effort hard thinking budgets.
   * @param config.thinkingLevelMap - effort id to wire effort-name map.
   * @param config.includeUsage - request stream usage reporting.
   * @param config.attachment - the optional attachment service (image bytes).
   * @param config.fetch - injectable fetch, for tests.
   */
  constructor(config = {}) {
    super()
    this.#baseURL = config.baseURL
    this.#model = config.model
    this.#displayName = config.displayName ?? config.model
    this.#apiKey = config.apiKey
    this.#attachment = config.attachment
    this.#config = config
    this.#fetch = config.fetch ?? globalThis.fetch
  }

  /** The chat-completions endpoint this adapter posts to. */
  get url() {
    return chatCompletionsUrl(this.#baseURL)
  }

  /**
   * @param provider - a route registered for this adapter.
   * @returns display metadata for that route.
   */
  providerInfo(provider) {
    return { id: provider, name: PROVIDER_NAME }
  }

  /**
   * Advertise the configured model. The local server serves whatever weights
   * it was started with, named by its alias; the catalog is advisory, so an
   * unlisted id passed by the caller is still forwarded. The selector name is
   * the configured display name (the wire id is an artifact alias) or the
   * model id when no display name is configured.
   * @param provider - a provider route owned by this adapter.
   * @returns the single configured model entry.
   */
  async listModels(provider) {
    return [{ provider, id: this.#model, name: this.#displayName, inputModalities: ['text', 'image'] }]
  }

  /**
   * Resolve exact-model metadata: the declared context capacity (required by
   * the pressure compaction policy) and the selectable reasoning efforts with
   * their adapter-configured hard budgets. Requests carrying an effort this
   * adapter does not declare fail with `UNSUPPORTED_REASONING_EFFORT` before
   * any wire traffic.
   * @param provider - registered provider route.
   * @param model - exact model id.
   * @returns provider/model identity plus context, call-default, and reasoning metadata.
   */
  async resolveModel(provider, model) {
    const efforts = [{ id: 'off', name: 'off' }]
    for (const [id, budgetTokens] of Object.entries(this.#config.thinkingBudgets ?? {})) {
      efforts.push({ id, name: id, budgetTokens })
    }
    return {
      provider,
      id: model,
      name: model,
      context: { contextWindow: this.#config.contextWindow },
      defaultMaxTokens: this.#config.maxTokens,
      reasoning: { efforts },
    }
  }

  /**
   * Synchronous per-request image pricing for the token meter. The alpha.3
   * meter resolves this unguarded on every measurement, and the rc.2 base
   * class predates the seam, so the adapter supplies the method. Every local
   * Qwen line is vision-capable: the NInfer line prices with its exact patch
   * formula; the llama.cpp line is clamped server-side, so the clamp maximum
   * is the conservative estimate. The data-URL wire carries no model-visible
   * text for a priced image, so the priced text is empty.
   * @param provider - a registered provider route.
   * @param model - the exact model id.
   * @returns one synchronous price per request image occurrence.
   */
  imageRequestPricing(_provider, _model) {
    const llamacpp = this.#config.dialect === 'llamacpp'
    return {
      priceImages: (images) => images.map((ref) => llamacpp
        ? { visualTokens: LLMACPP_IMAGE_TOKEN_CAP, text: '' }
        : { visualTokens: ninferVisionTokens(ref.width, ref.height), text: '' }),
    }
  }

  /**
   * Stream one model call.
   * @param options - the assembled request; `options.signal` is forwarded to `fetch`.
   * @yields harness stream chunks, terminal `finish` last.
   */
  async *stream(options) {
    assertRepresentable(options)
    const imageDataUrls = await resolveImageDataUrls(this.#attachment, options)
    const url = this.url
    const response = await this.#post(url, options, imageDataUrls)

    if (!response.ok) {
      const detail = await response.text().catch(() => '')
      throw new LlmError(
        `dsh-qwen38-local-qol: server at ${url} returned HTTP ${response.status}${detail ? `: ${detail.slice(0, MAX_ERROR_BODY_CHARS)}` : ''}`,
        PROVIDER_HTTP_ERROR_CODE,
        { status: response.status },
      )
    }

    if ((response.headers.get('content-type') ?? '').includes('json')) {
      yield* chunksFromCompletion(await response.json())
      return
    }

    yield* this.#streamSse(response, options)
  }

  /**
   * Perform the request, turning transport failures into a stable code.
   * @param url - the chat-completions endpoint.
   * @param options - the assembled request.
   * @param imageDataUrls - resolved image data URLs for the request body.
   * @returns the raw response.
   */
  async #post(url, options, imageDataUrls) {
    try {
      return await this.#fetch(url, {
        method: 'POST',
        headers: requestHeaders(attributionHeaders(), this.#apiKey),
        body: JSON.stringify(buildQwenBody(options, this.#model, this.#config, imageDataUrls)),
        signal: options.signal,
      })
    } catch (cause) {
      // A caller-driven abort is the caller's own outcome, not a dead server:
      // the runtime turns it into an `aborted` finish.
      if (options.signal?.aborted) throw cause
      throw new LlmError(
        `dsh-qwen38-local-qol: cannot reach the Qwen3.8 server at ${url} (is the server running?): ${errorChain(cause)}`,
        PROVIDER_UNREACHABLE_CODE,
        { cause },
      )
    }
  }

  /**
   * Decode an SSE body into harness chunks.
   * @param response - the streaming response.
   * @param options - the assembled request, for its signal.
   * @yields harness stream chunks.
   */
  async *#streamSse(response, options) {
    const parser = createSseParser()
    const translator = createChunkTranslator()
    const decoder = new TextDecoder()
    let done = false

    const handle = function* (payloads) {
      for (const payload of payloads) {
        if (done) return
        if (payload === '[DONE]') {
          done = true
          return
        }
        yield* translator.accept(parseFrame(payload))
      }
    }

    try {
      for await (const bytes of iterateBody(response, this.url)) {
        yield* handle(parser.push(decoder.decode(bytes, { stream: true })))
        if (done) break
      }
      if (!done) yield* handle(parser.flush())
    } catch (cause) {
      if (options.signal?.aborted || cause instanceof LlmError) throw cause
      const failure = new LlmError(
        `dsh-qwen38-local-qol: Qwen3.8 stream from ${this.url} ended badly: ${errorChain(cause)}`,
        PROVIDER_UNREACHABLE_CODE,
        { cause },
      )
      if (cause?.code === PROVIDER_PROTOCOL_ERROR_CODE || cause?.code === PROVIDER_ERROR_CODE) failure.code = cause.code
      throw failure
    }

    yield* translator.end()
  }
}

/**
 * Resolve the `data:` URL for every user image block in the request through
 * the attachment service (optional seam). A block whose bytes cannot be read
 * degrades to the text placeholder so one unreadable image never fails the
 * request.
 * @param attachment - the attachment service, or undefined.
 * @param options - the assembled request.
 * @returns a map from image block to its `data:` URL.
 */
async function resolveImageDataUrls(attachment, options) {
  const urls = new Map()
  if (attachment === undefined || typeof attachment.readImage !== 'function') return urls
  for (const message of options.messages ?? []) {
    for (const block of message.content ?? []) {
      if (block.type !== 'image') continue
      try {
        const stored = await attachment.readImage(block.attachment, options.signal)
        urls.set(block, `data:${stored.ref.mediaType};base64,${Buffer.from(stored.data).toString('base64')}`)
      } catch {
        // Unreadable image (store churn, digest mismatch): the placeholder
        // keeps the request honest about what the model will not see.
      }
    }
  }
  return urls
}

/**
 * Refuse content this adapter cannot project onto the wire, before any wire
 * traffic: an image on the assistant side has no representation, and an
 * unknown merge-extensible block type must not be silently dropped.
 * @param options - the assembled request.
 */
function assertRepresentable(options) {
  for (const message of options.messages ?? []) {
    if (message.role === 'assistant') {
      for (const block of message.content ?? []) {
        if (block.type === 'image') {
          throw new LlmError(
            'dsh-qwen38-local-qol: assistant messages cannot carry image blocks to the local Qwen3.8 server',
            UNSUPPORTED_CONTENT_CODE,
          )
        }
        if (block.type !== 'text' && block.type !== 'reasoning' && block.type !== 'tool-call') {
          throw new LlmError(
            `dsh-qwen38-local-qol: cannot send an assistant "${block.type}" content block`,
            UNSUPPORTED_CONTENT_CODE,
          )
        }
      }
      continue
    }
    for (const block of message.content ?? []) {
      if (block.type === 'text' || block.type === 'image' || block.type === 'tool-result') continue
      throw new LlmError(
        `dsh-qwen38-local-qol: cannot send a "${block.type}" content block to the local Qwen3.8 server`,
        UNSUPPORTED_CONTENT_CODE,
      )
    }
  }
}

/**
 * Iterate a response body as byte chunks, refusing a body-less response
 * instead of silently yielding an empty stream.
 * @param response - the streaming response.
 * @param endpoint - endpoint for the diagnostic.
 * @yields raw byte chunks.
 */
async function* iterateBody(response, endpoint) {
  if (!response.body) {
    throw new LlmError(
      `dsh-qwen38-local-qol: server at ${endpoint} returned no response body`,
      PROVIDER_UNREACHABLE_CODE,
    )
  }
  yield* response.body
}
