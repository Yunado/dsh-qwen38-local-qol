/**
 * Pure region preparation for the summarizer prefill: keep recent reasoning,
 * strip images, cap tool results. Each reduction shrinks the prompt without
 * touching the real conversation, so the slow prefill of a slow local model
 * stays bounded. The logic is the Qwen3.8 local-line fix, kept here so the
 * backend stays independent of the installed compaction-basic's internal
 * summarizer exports.
 *
 * @module dsh-qwen38-local-qol/prepare
 */

/** Trim policy for the summarizer prefill. */
export const DEFAULT_TRIM_KNOBS = Object.freeze({
  /** `'strip'` reduces image blocks to text placeholders; `'keep'` retains them. */
  images: 'strip',
  /** Assistant turns at the region tail whose reasoning blocks are kept; older reasoning is stripped. */
  keepTurns: 5,
  /** Per-tool-result character cap; larger results are elided. `0` disables. */
  toolChars: 2000,
  /**
   * The checkpoint-to-prefill ratio the adaptive summary cap reserves: the
   * cap-finding request asks for `ceil(capRatio x prefill)` output tokens when
   * the line's window affords it (a measured verbose model runs ~0.6; the
   * default keeps a quarter margin). Valid range 0.1..2.
   */
  capRatio: 0.75,
})

/** Bounds for the resolved `capRatio`; a malformed value falls back to the default. */
const CAP_RATIO_MIN = 0.1
const CAP_RATIO_MAX = 2

/**
 * Resolve the trim knobs from the environment. Unknown or malformed values
 * fall back to the defaults so one bad variable cannot change policy.
 * @param env - environment to read; defaults to `process.env`.
 * @returns the resolved knobs.
 */
export function resolveTrimKnobs(env = process.env) {
  const images = env.DSH_QWEN38_SUMMARIZE_IMAGES === 'keep' || env.DSH_QWEN38_SUMMARIZE_IMAGES === 'strip'
    ? env.DSH_QWEN38_SUMMARIZE_IMAGES
    : DEFAULT_TRIM_KNOBS.images
  const keepTurns = /^\d+$/.test(env.DSH_QWEN38_SUMMARIZE_KEEP_TURNS ?? '')
    ? Number.parseInt(env.DSH_QWEN38_SUMMARIZE_KEEP_TURNS, 10)
    : DEFAULT_TRIM_KNOBS.keepTurns
  const toolChars = /^\d+$/.test(env.DSH_QWEN38_SUMMARIZE_TOOL_CHARS ?? '')
    ? Number.parseInt(env.DSH_QWEN38_SUMMARIZE_TOOL_CHARS, 10)
    : DEFAULT_TRIM_KNOBS.toolChars
  const capRatioRaw = Number.parseFloat(env.DSH_QWEN38_SUMMARIZE_CAP_RATIO ?? '')
  const capRatio = Number.isFinite(capRatioRaw) && capRatioRaw >= CAP_RATIO_MIN && capRatioRaw <= CAP_RATIO_MAX
    ? capRatioRaw
    : DEFAULT_TRIM_KNOBS.capRatio
  return { images, keepTurns, toolChars, capRatio }
}

/** Character-to-token divisor of the prefill estimate; deliberately pessimistic for mixed CJK text. */
const ESTIMATE_CHARS_PER_TOKEN = 3

/** Character price of one retained image block (the llamacpp line's pinned per-image cost). */
const ESTIMATE_IMAGE_TOKENS = 1536

/** Sum the priced characters of one content block list, recursing into tool results. */
function countBlockChars(blocks) {
  let chars = 0
  for (const block of blocks ?? []) {
    if (block.type === 'text' || block.type === 'reasoning') chars += block.text.length
    else if (block.type === 'tool-result') chars += countBlockChars(block.content)
    else if (block.type === 'tool-call') chars += (block.name ?? '').length + JSON.stringify(block.input ?? {}).length
    else if (block.type === 'image') chars += ESTIMATE_IMAGE_TOKENS * ESTIMATE_CHARS_PER_TOKEN
  }
  return chars
}

/**
 * Estimate the prompt tokens of the summarizer call about to be sent: the
 * prepared region plus the tool schemas the call replays (the request is the
 * last routed request's prefix, tools included). An overestimate is the safe
 * direction: it shrinks the derived cap and pulls the early-refusal line closer.
 * @param messages - the prepared (trimmed) region.
 * @param tools - the tool schemas the call replays, when any.
 * @returns the estimated prompt tokens.
 */
export function estimatePrefillTokens(messages, tools) {
  let chars = 0
  for (const message of messages ?? []) chars += countBlockChars(message.content)
  if (tools !== undefined && tools !== null) chars += JSON.stringify(tools).length
  return Math.ceil(chars / ESTIMATE_CHARS_PER_TOKEN)
}

/** Replace one image block with a terse text placeholder naming the file and dimensions. */
function imagePlaceholder(block) {
  const { name, mediaType, width, height } = block.attachment ?? {}
  return { type: 'text', text: `[image: ${name ?? mediaType} ${width}x${height}]` }
}

/** Recursively replace image blocks, including images nested inside tool results. */
function replaceImageBlocks(blocks) {
  return blocks.map((block) => {
    if (block.type === 'image') return imagePlaceholder(block)
    if (block.type === 'tool-result') return { ...block, content: replaceImageBlocks(block.content) }
    return block
  })
}

/** Recursively cap tool-result text, including tool results nested inside tool results. */
function capToolResultContent(content, maxChars) {
  return content.map((block) => (
    block.type === 'tool-result' ? { ...block, content: capToolResultContent(block.content, maxChars) } : capBlockText(block, maxChars)
  ))
}

/** Truncate an oversized text block; pass every other block through unchanged. */
function capBlockText(block, maxChars) {
  if (block.type !== 'text' || block.text.length <= maxChars) return block
  const kept = block.text.slice(0, maxChars)
  const elided = block.text.length - maxChars
  return { type: 'text', text: `${kept}\n… [${elided} more chars elided]` }
}

/**
 * Drop reasoning blocks from every assistant message except the last `keepTurns`
 * turns of the region, so the summarizer prefill carries only the model's recent
 * thinking. Output (text and tool calls) is untouched. An older turn's replay
 * projection is dropped with its reasoning, because the reduced content no
 * longer matches the stored block count.
 * @param messages - the replayed region.
 * @param keepTurns - assistant turns at the region tail whose reasoning is kept; `0` strips all.
 * @returns a new message array with older reasoning removed.
 */
export function keepRecentReasoning(messages, keepTurns) {
  const assistantIndexes = []
  messages.forEach((message, i) => {
    if (message.role === 'assistant') assistantIndexes.push(i)
  })
  const keepFrom = Math.max(0, assistantIndexes.length - keepTurns)
  const keep = new Set(assistantIndexes.slice(keepFrom))
  return messages.map((message, i) => {
    if (message.role !== 'assistant' || keep.has(i)) return message
    const source = message.source
    return {
      ...message,
      content: message.content.filter((block) => block.type !== 'reasoning'),
      // Reduced content no longer matches the stored replay projection; drop it
      // so a model-produced turn is treated as foreign instead of failing replay validation.
      source: source && source.kind === 'model'
        ? { kind: 'model', provider: source.provider, model: source.model }
        : source,
    }
  })
}

/**
 * Prepare the replayed region for the auxiliary summarizer prefill by applying
 * the configured reductions in order: keep recent reasoning, strip images, and
 * cap tool results.
 * @param messages - the replayed region to condense.
 * @param knobs - the resolved trim policy ({ images, keepTurns, toolChars }).
 * @returns a new message array ready for the summarizer prompt.
 */
export function prepareSummaryRegion(messages, knobs = DEFAULT_TRIM_KNOBS) {
  let prepared = keepRecentReasoning(messages, knobs.keepTurns)
  if (knobs.images === 'strip') {
    prepared = prepared.map((message) => ({ ...message, content: replaceImageBlocks(message.content) }))
  }
  if (knobs.toolChars > 0) {
    prepared = prepared.map((message) => (
      // 0.2.0 shape: a `role: 'tool'` message's blocks are the tool result
      // itself - cap them in place. The wrapped `tool-result` block form is
      // kept for pre-0.2.0 history replayed into the region.
      message.role === 'tool'
        ? { ...message, content: capToolResultContent(message.content, knobs.toolChars) }
        : {
          ...message,
          content: message.content.map((block) => (
            block.type === 'tool-result' ? { ...block, content: capToolResultContent(block.content, knobs.toolChars) } : block
          )),
        }
    ))
  }
  return prepared
}
