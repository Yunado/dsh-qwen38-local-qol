/**
 * The Qwen3.8 local-line compaction backend: the stock basic compaction
 * engine with two overrides.
 *
 * - `compactIfNeeded`: before each trigger evaluation, the live
 *   `compactThresholdPct` from the user-settings section (the Settings tab's
 *   slider) becomes the engine's `thresholdRatio`, so moving the slider moves
 *   the next automatic compaction without any restart. `headroomTokens`
 *   always becomes the wall guard (a sixteenth of the line's pressure
 *   budget, floored at 8192 and capped at a quarter), so even a top-of-slider
 *   trigger leaves room for one step's growth before the server's
 *   context-overflow wall. Without a settings section (env layer / bare unit
 *   receivers) the row's ratio stands and the guard still applies.
 * - `summarize`: the summarizer prefill is trimmed before the one-shot call
 *   (recent reasoning only, images stripped, tool results capped). The trim
 *   keeps the auxiliary call's input bounded so a slow local model does not
 *   idle out under the stream watchdog; thinking stays off for the call
 *   because the wire forces it off for `purpose: 'compaction'` requests, so
 *   the whole output cap is available for the checkpoint instead of burning
 *   it on thinking.
 *
 * Mounted as a service row in the `qwen38` preset roster declared by this
 * bundle (`presets/qwen38.patch.yml`), inside the preset's isolated compaction
 * group. The row config is the stock `BasicCompactionConfig`; the only
 * recommended row value is `maxTokens: 52428` (the stock 8192 default
 * truncates long local checkpoints); the wire also raises any compaction
 * call to the line's output cap, which covers presets without this row. The
 * trigger and trim knobs come from the plugin row's live config (the Settings
 * tab's `compactThresholdPct` and `summarize` block, via the module mirror
 * {@link liveConfigView}) while that row is mounted, else the legacy settings
 * namespace, else environment variables (see {@link resolveTrimKnobs}) so the
 * row carries no keys the stock config schema does not know.
 *
 * @module dsh-qwen38-local-qol/backend
 */
import BasicCompactionEngine from '@deepseek-ai/dsh-compaction-basic'
import { plainConfig } from './config.js'
import { prepareSummaryRegion, resolveTrimKnobs, DEFAULT_TRIM_KNOBS } from './prepare.js'
import { NS, liveConfigView } from './settings-section.js'

/** Inclusive bounds for the live trigger percent (mirrors `validateSection`). */
const TRIGGER_PCT_MIN = 50
const TRIGGER_PCT_MAX = 99

/**
 * Tokens kept between the highest compaction trigger and the request wall
 * (`contextWindow - output cap`). A step boundary only measures the last
 * request; the next one grows by its new tool results and injected context,
 * so a trigger at the wall itself admits requests the server rejects with a
 * context-overflow 400. The guard scales with the line: one sixteenth of the
 * pressure budget, floored at 8192 (a step's growth barely fits below that)
 * and capped at a quarter of the budget (more would starve the trigger).
 * Mirrored by the client's slider cap.
 */
const WALL_GUARD_TOKENS = 16384
const WALL_GUARD_MIN_TOKENS = 8192

/** Unwrap one value a volatile leaf may deliver wrapped. */
function plainValue(value) {
  return value !== null && typeof value === 'object' && typeof value.get === 'function' ? value.get() : value
}

/**
 * The wall guard for the active line: the section mirrors the active line's
 * `contextWindow` / `maxTokens`, so the guard follows that line's pressure
 * budget.
 * @param section - the resolved user-settings section (or undefined).
 * @returns the token count for the engine config's `headroomTokens`.
 */
function wallGuardTokens(section) {
  const windowTokens = plainValue(section?.contextWindow)
  const outputTokens = plainValue(section?.maxTokens)
  if (!Number.isInteger(windowTokens) || windowTokens <= 0
    || !Number.isInteger(outputTokens) || outputTokens < 0 || windowTokens <= outputTokens) {
    return WALL_GUARD_TOKENS
  }
  const budget = windowTokens - outputTokens
  return Math.min(Math.max(Math.floor(budget / 16), WALL_GUARD_MIN_TOKENS), Math.floor(budget / 4))
}

/**
 * The user-settings section, live. The 0.2.0 route: this module's mirror of
 * the plugin row's config, published by the entry fiber (`publishLiveConfig`)
 * and resolved through `plainConfig` per read, so hot commits are seen
 * immediately. The legacy route, kept for the env layer and bare unit
 * receivers that still serve one: a context settings namespace under
 * {@link NS}. Module function, no private-member access, so prototype-only
 * receivers keep working.
 * @param ctx - the engine's cordis context.
 * @returns the resolved section object, or undefined without either route.
 */
function settingsSection(ctx) {
  const live = liveConfigView()
  if (live !== null && typeof live === 'object') return plainConfig(live)
  const settings = typeof ctx?.get === 'function' ? ctx.get('settings') : undefined
  const section = typeof settings?.get === 'function' ? settings.get(NS) : undefined
  return section !== null && typeof section === 'object' ? section : undefined
}

/**
 * The live trigger ratio from `compactThresholdPct` (a volatile leaf may
 * arrive wrapped, so unwrap first).
 * @param section - the resolved user-settings section (or undefined).
 * @returns the ratio in (0, 1), or undefined when the section carries no valid value.
 */
function liveThresholdRatio(section) {
  const pct = plainValue(section?.compactThresholdPct)
  return Number.isInteger(pct) && pct >= TRIGGER_PCT_MIN && pct <= TRIGGER_PCT_MAX ? pct / 100 : undefined
}

/**
 * Basic compaction with a live trigger ratio and a trimmed summarizer prefill.
 */
export class QwenLocalCompaction extends BasicCompactionEngine {
  /** The row config, kept as the untouched base each trigger evaluation rebuilds from. */
  baseConfig

  /** @param ctx - cordis context; @param config - the stock `BasicCompactionConfig` from the service row. */
  constructor(ctx, config) {
    super(ctx, config)
    this.baseConfig = this.config
  }

  /**
   * Apply the live trigger ratio and the wall guard to the engine config,
   * then delegate: the pressure decision stays the stock path
   * (`min(window x thresholdRatio, window - reserved output - headroomTokens)`),
   * with the slider refreshing the ratio and `headroomTokens` holding the
   * trigger back from the request wall by one step's growth. Without a live
   * ratio the row base's ratio stands, so a removed setting never leaves a
   * stale one; the guard applies either way.
   * @param agent - agent whose latest durable routed request is measured.
   * @param trigger - normal step-boundary pressure or context-overflow recovery.
   * @param signal - live turn cancellation signal forwarded to summarization.
   * @returns the latest summary compaction result, or `null` when no summary ran.
   */
  async compactIfNeeded(agent, trigger, signal) {
    const base = this.baseConfig ?? this.config
    const section = settingsSection(this.ctx)
    const ratio = liveThresholdRatio(section)
    const guard = wallGuardTokens(section)
    this.config = ratio === undefined
      ? { ...base, headroomTokens: guard }
      : { ...base, thresholdRatio: ratio, headroomTokens: guard }
    return super.compactIfNeeded(agent, trigger, signal)
  }

  /**
   * Trim the replayed region, then delegate to the stock summarization path
   * (target resolution, the `reasoningEffort: off` one-shot
   * `ctx.llm.stream()` call, and the checkpoint envelope) so every pricing
   * and replay decision stays the engine's.
   * @param input - replayed conversation prefix (system, tools, and leading messages) to condense.
   * @param agent - supplies routed-model history, fallback model, and session id.
   * @param signal - optional cancellation forwarded to the adapter.
   * @returns safe text summary blocks and the exact auxiliary call envelope and output.
   */
  async summarize(input, agent, signal) {
    // Trim knobs, live: the user-settings section's resolved `summarize`
    // block when its namespace is registered (the schema resolves it
    // complete, with defaults for untouched fields), else the environment
    // layer.
    const sectionKnobs = settingsSection(this.ctx)?.summarize
    const knobs = sectionKnobs !== undefined && typeof sectionKnobs === 'object'
      ? { ...DEFAULT_TRIM_KNOBS, ...sectionKnobs }
      : resolveTrimKnobs(process.env)
    const prepared = prepareSummaryRegion(input.messages, knobs)
    return super.summarize({ ...input, messages: prepared }, agent, signal)
  }
}

export default QwenLocalCompaction
