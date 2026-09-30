/**
 * The plugin's configuration schema.
 *
 * Two surfaces share one schema factory:
 *
 * - `Config` (exported const): the cordis Config of the plugin row. Since
 *   dsh 0.2.0 the profile's plugin-config store IS the settings surface -
 *   the host auto-generates the edit form from this schema and persists
 *   edits as a profile Cordis patch. Every user-facing leaf is declared
 *   `.volatile()`, so an edit commits into the running config reference and
 *   emits `loader/volatile-update` without remounting the fiber; the adapter
 *   re-reads its resolved view per request, so a saved change lands on the
 *   next wire call.
 * - `sectionSchema()`: the plain (non-volatile) base, kept for the resolve
 *   fallbacks, tests, and the legacy settings-namespace path pre-0.2.0.
 *
 * The `line` selector (empty = legacy flat form): the profile patch keeps
 * every server line's knobs side by side under `lines.<dialect>`; setting
 * `line` to a dialect makes that block the active one in one edit.
 *
 * @module dsh-qwen38-local-qol/settings-section
 */
import Schema from '@deepseek-ai/schemastery'
import {
  DIALECTS,
  DIALECT_LLAMACPP,
  DIALECT_NINFER,
  DEFAULT_BASE_URL,
  DEFAULT_CONTEXT_WINDOW,
  DEFAULT_LLAMA_BASE_URL,
  DEFAULT_LLAMA_MODEL,
  DEFAULT_MAX_TOKENS,
  DEFAULT_MODEL,
  DEFAULT_OMLX_BASE_URL,
  DEFAULT_OMLX_CONTEXT_WINDOW,
  DEFAULT_OMLX_MAX_TOKENS,
  DEFAULT_OMLX_MODEL,
  DEFAULT_TABBYAPI_BASE_URL,
  DEFAULT_TABBYAPI_CONTEXT_WINDOW,
  DEFAULT_TABBYAPI_MAX_TOKENS,
  DEFAULT_TABBYAPI_MODEL,
  DEFAULT_THINKING_BUDGETS,
} from './config.js'
import { DEFAULT_TRIM_KNOBS } from './prepare.js'

/** The settings namespace this plugin owned pre-0.2.0 (kept for status text and tests). */
export const NS = 'qwen38-local-qol'

/**
 * The plugin row's live config reference, published by the entry fiber.
 *
 * Why a module mirror: the compaction backend is mounted in a preset fiber,
 * not this row's fiber, and the 0.2.0 host's `settings` service exposes only
 * describe/update/mutate (the pre-0.2.0 `settings.get(ns)` seam is gone) under
 * namespaces that are profile entry ids, not this module's NS. So the backend
 * cannot reach this row's live section through the context; the entry fiber's
 * own live config reference is the only route to `compactThresholdPct` and the
 * `summarize` knobs. It is stored still wrapped: readers resolve each volatile
 * leaf per read, so a hot commit is visible without republishing. One plugin
 * row per process; a fiber's disposal clears only its own reference.
 */
let liveConfig = undefined

/** Publish this row's live config reference (undefined clears the mirror). */
export function publishLiveConfig(config) { liveConfig = config }

/** The live config reference, or undefined when no row is mounted. */
export function liveConfigView() { return liveConfig }

/** Identity modifier for the plain schema variant. */
const plain = (schema) => schema
/** Volatile modifier: the leaf is hot-editable (no remount) in 0.2.0 hosts. */
const volatile = (schema) => schema.volatile()

/**
 * The per-dialect line block. Each server line (llama.cpp, NInfer, TabbyAPI) remembers
 * its own connection (`baseURL`/`model`/`displayName`) and its own window
 * numbers (`contextWindow`/`maxTokens`/`thinkingBudgets`): the context window
 * is a property of the line's server build (its `-c`, bounded by that line's
 * VRAM and quantization), not of the model - two lines of the same model may
 * legitimately carry different windows, and a shared window would
 * miscalibrate the compaction threshold of the smaller one. The top-level
 * `baseURL`/`model`/`displayName`/`contextWindow`/`maxTokens`/`thinkingBudgets`
 * plus `defaultThinkingBudget` and `summarize` stay authoritative at the top
 * level for the adapter and the compaction backend while `line` is empty (the
 * shipped patch rows use that flat form); `lines` is the per-dialect memory,
 * and the block named by `line` becomes the live one when it is set -
 * including the thinking budget (a property of the line's server build, e.g.
 * NInfer's `--default-thinking-budget`) and the trim knobs (a per-line
 * preference).
 */
function lineSchema(baseURL, model, contextWindow, maxTokens, budgets, mark) {
  return Schema.object({
    baseURL: mark(Schema.string()).default(baseURL),
    model: mark(Schema.string()).default(model),
    displayName: mark(Schema.string()).default(''),
    // This line's own server credential (empty = keyless). The top-level
    // `apiKey` mirrors the ACTIVE line and is what the adapter sends
    // (Authorization: Bearer).
    apiKey: mark(Schema.string()).default(''),
    contextWindow: mark(Schema.number()).default(contextWindow),
    maxTokens: mark(Schema.number()).default(maxTokens),
    thinkingBudgets: Schema.object({
      low: mark(Schema.number()).default(budgets.low),
      medium: mark(Schema.number()).default(budgets.medium),
      xhigh: mark(Schema.number()).default(budgets.xhigh),
    }),
    defaultThinkingBudget: mark(Schema.number()).default(16384),
    summarize: Schema.object({
      images: mark(Schema.string()).default(DEFAULT_TRIM_KNOBS.images),
      keepTurns: mark(Schema.number()).default(DEFAULT_TRIM_KNOBS.keepTurns),
      toolChars: mark(Schema.number()).default(DEFAULT_TRIM_KNOBS.toolChars),
    }),
  })
}

/**
 * Build one variant of the config schema.
 * @param mark - leaf modifier (`plain` or `volatile`).
 * @returns the schemastery object schema.
 */
function buildSchema(mark) {
  return Schema.object({
    // The line selector (empty = the flat top-level form below stays
    // authoritative; a dialect name activates that `lines` block wholesale).
    line: mark(Schema.string()).default(''),
    dialect: mark(Schema.string()).default(DIALECT_LLAMACPP),
    baseURL: mark(Schema.string()).default(DEFAULT_LLAMA_BASE_URL),
    model: mark(Schema.string()).default(DEFAULT_LLAMA_MODEL),
    displayName: mark(Schema.string()).default(''),
    lines: Schema.object({
      ninfer: lineSchema(DEFAULT_BASE_URL, DEFAULT_MODEL, DEFAULT_CONTEXT_WINDOW, DEFAULT_MAX_TOKENS, DEFAULT_THINKING_BUDGETS, mark),
      llamacpp: lineSchema(DEFAULT_LLAMA_BASE_URL, DEFAULT_LLAMA_MODEL, DEFAULT_CONTEXT_WINDOW, DEFAULT_MAX_TOKENS, DEFAULT_THINKING_BUDGETS, mark),
      tabbyapi: lineSchema(DEFAULT_TABBYAPI_BASE_URL, DEFAULT_TABBYAPI_MODEL, DEFAULT_TABBYAPI_CONTEXT_WINDOW, DEFAULT_TABBYAPI_MAX_TOKENS, DEFAULT_THINKING_BUDGETS, mark),
      omlx: lineSchema(DEFAULT_OMLX_BASE_URL, DEFAULT_OMLX_MODEL, DEFAULT_OMLX_CONTEXT_WINDOW, DEFAULT_OMLX_MAX_TOKENS, DEFAULT_THINKING_BUDGETS, mark),
    }),
    apiKey: mark(Schema.string()).default(''),
    contextWindow: mark(Schema.number()).default(DEFAULT_CONTEXT_WINDOW),
    maxTokens: mark(Schema.number()).default(DEFAULT_MAX_TOKENS),
    thinkingBudgets: Schema.object({
      low: mark(Schema.number()).default(DEFAULT_THINKING_BUDGETS.low),
      medium: mark(Schema.number()).default(DEFAULT_THINKING_BUDGETS.medium),
      xhigh: mark(Schema.number()).default(DEFAULT_THINKING_BUDGETS.xhigh),
    }),
    defaultThinkingBudget: mark(Schema.number()).default(16384),
    defaultEffort: mark(Schema.string()).default('medium'),
    thinkingLevelMap: mark(Schema.dict(Schema.string())).default({}),
    includeUsage: mark(Schema.boolean()).default(true),
    summarize: Schema.object({
      images: mark(Schema.string()).default(DEFAULT_TRIM_KNOBS.images),
      keepTurns: mark(Schema.number()).default(DEFAULT_TRIM_KNOBS.keepTurns),
      toolChars: mark(Schema.number()).default(DEFAULT_TRIM_KNOBS.toolChars),
    }),
    // Where automatic pressure compaction fires, as a percent of the active
    // line's context window: the compaction backend reads it at every trigger
    // evaluation and feeds the engine's thresholdRatio (hot, no restart). The
    // floor 50: below that the fixed overhead (system prompt + tool
    // definitions) plus the checkpoint floor would leave compaction cycles
    // almost nothing to free; the ceiling 99 leaves the line's own output
    // reservation to cap the effective point (the engine takes
    // `min(window x ratio, window - output)`).
    compactThresholdPct: mark(Schema.number()).default(80),
    // The compaction wiring status rode the pre-0.2.0 section base (the tab
    // rendered it); the 0.2.0 Config does not carry status fields - the
    // preset is statically declared by the bundle patch.
    compaction: Schema.object({
      presetGenerated: mark(Schema.boolean()).default(false),
      defaultPreset: mark(Schema.string()).default('standard'),
    }),
  })
}

/**
 * The plugin's cordis Config (0.2.0 host surface). Unknown keys pass through,
 * so a row base carrying extra keys (e.g. `provider`) stays intact.
 * @returns the schemastery object schema for the section.
 */
export function sectionSchema() {
  return buildSchema(plain)
}

/** The hot-editable cordis Config for the plugin row. */
export const Config = buildSchema(volatile)

/**
 * Cross-field validation for a resolved config the schema alone cannot
 * express. Fails loud so a bad settings write is refused at the write, not met
 * mid-request.
 * @param value - the resolved config, schema-valid by construction.
 * @throws {Error} when a field combination the adapter cannot serve.
 */
export function validateSection(value) {
  // Each check only fires on a field the document actually carries (a host
  // parse fills every schema default, so in the 0.2.0 store path everything
  // present is still checked; bare unit-test configs stay silent on absence).
  if (value.dialect !== undefined && DIALECTS.includes(value.dialect) === false) {
    throw new Error(`dsh-qwen38-local-qol: dialect must be one of ${DIALECTS.map((d) => `"${d}"`).join(', ')}, got "${value.dialect}"`)
  }
  if (typeof value.line === 'string' && value.line.trim() !== '' && !DIALECTS.includes(value.line.trim())) {
    throw new Error(`dsh-qwen38-local-qol: line must be empty or one of ${DIALECTS.map((d) => `"${d}"`).join(', ')}, got "${value.line}"`)
  }
  const budgets = value.thinkingBudgets ?? {}
  for (const [effort, budgetTokens] of Object.entries(budgets)) {
    if (!Number.isInteger(budgetTokens) || budgetTokens <= 0) {
      throw new Error(`dsh-qwen38-local-qol: thinkingBudgets["${effort}"] must be a positive integer, got ${String(budgetTokens)}`)
    }
  }
  if (value.defaultThinkingBudget !== undefined && (!Number.isInteger(value.defaultThinkingBudget) || value.defaultThinkingBudget <= 0)) {
    throw new Error(`dsh-qwen38-local-qol: defaultThinkingBudget must be a positive integer, got ${String(value.defaultThinkingBudget)}`)
  }
  // The per-line memory carries the same window numbers; validate each line
  // so a hand-edited document cannot park a bad number that later goes live.
  for (const [lineName, line] of Object.entries(value.lines ?? {})) {
    if (line === undefined || line === null || typeof line !== 'object') continue
    for (const knob of ['contextWindow', 'maxTokens']) {
      const raw = line[knob]
      if (raw !== undefined && (!Number.isInteger(raw) || raw <= 0)) {
        throw new Error(`dsh-qwen38-local-qol: lines.${lineName}.${knob} must be a positive integer, got ${String(raw)}`)
      }
    }
    for (const [effort, budgetTokens] of Object.entries(line.thinkingBudgets ?? {})) {
      if (!Number.isInteger(budgetTokens) || budgetTokens <= 0) {
        throw new Error(`dsh-qwen38-local-qol: lines.${lineName}.thinkingBudgets["${effort}"] must be a positive integer, got ${String(budgetTokens)}`)
      }
    }
    const lineDefaultBudget = line.defaultThinkingBudget
    if (lineDefaultBudget !== undefined && (!Number.isInteger(lineDefaultBudget) || lineDefaultBudget <= 0)) {
      throw new Error(`dsh-qwen38-local-qol: lines.${lineName}.defaultThinkingBudget must be a positive integer, got ${String(lineDefaultBudget)}`)
    }
    const lineImages = line.summarize?.images
    if (lineImages !== undefined && lineImages !== 'strip' && lineImages !== 'keep') {
      throw new Error(`dsh-qwen38-local-qol: lines.${lineName}.summarize.images must be "strip" or "keep", got "${lineImages}"`)
    }
    for (const knob of ['keepTurns', 'toolChars']) {
      const raw = line.summarize?.[knob]
      if (raw !== undefined && (!Number.isInteger(raw) || raw < 0)) {
        throw new Error(`dsh-qwen38-local-qol: lines.${lineName}.summarize.${knob} must be a non-negative integer, got ${String(raw)}`)
      }
    }
  }
  if (value.defaultEffort !== undefined && value.defaultEffort !== 'off' && budgets[value.defaultEffort] === undefined) {
    throw new Error(`dsh-qwen38-local-qol: defaultEffort "${value.defaultEffort}" is not a declared effort ("off" + thinkingBudgets keys)`)
  }
  if (value.summarize !== undefined) {
    const images = value.summarize?.images
    if (images !== undefined && images !== 'strip' && images !== 'keep') {
      throw new Error(`dsh-qwen38-local-qol: summarize.images must be "strip" or "keep", got "${images}"`)
    }
    for (const knob of ['keepTurns', 'toolChars']) {
      const raw = value.summarize?.[knob]
      if (raw !== undefined && (!Number.isInteger(raw) || raw < 0)) {
        throw new Error(`dsh-qwen38-local-qol: summarize.${knob} must be a non-negative integer, got ${String(raw)}`)
      }
    }
  }
  // The status fields ride the legacy section base only; a 0.2.0 Config has
  // none. Validate them when present so a hand-edited legacy document cannot
  // park junk the old tab would render.
  if (value.compactThresholdPct !== undefined
    && (!Number.isInteger(value.compactThresholdPct)
      || value.compactThresholdPct < 50 || value.compactThresholdPct > 99)) {
    throw new Error(`dsh-qwen38-local-qol: compactThresholdPct must be an integer 50..99, got ${String(value.compactThresholdPct)}`)
  }
  if (value.compaction !== undefined) {
    if (typeof value.compaction?.presetGenerated !== 'boolean') {
      throw new Error(`dsh-qwen38-local-qol: compaction.presetGenerated must be a boolean, got ${String(value.compaction?.presetGenerated)}`)
    }
    if (typeof value.compaction?.defaultPreset !== 'string' || value.compaction.defaultPreset.trim() === '') {
      throw new Error(`dsh-qwen38-local-qol: compaction.defaultPreset must be a non-empty string, got ${String(value.compaction?.defaultPreset)}`)
    }
  }
}
