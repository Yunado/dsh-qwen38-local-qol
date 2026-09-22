/**
 * The plugin's user-settings section: the Settings tab's persisted namespace.
 *
 * The host registers this namespace (via `settings.installSection`) with the
 * patch row as the composition base; the browser tab reads and writes it
 * through the settings Remote, and the adapter reads the resolved value per
 * request so a saved change applies on the next wire call without a restart.
 *
 * Schema defaults mirror `resolveConfig`'s built-ins so a namespace read
 * without any user or base layer opens on the general default (the
 * llama.cpp line; NInfer and TabbyAPI are the per-line memory under
 * `lines.ninfer` / `lines.tabbyapi`). `thinkingBudgets`
 * keys and `defaultEffort` are cross-validated (the schema cannot express
 * "effort id must be a declared budget key").
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
  DEFAULT_TABBYAPI_BASE_URL,
  DEFAULT_TABBYAPI_CONTEXT_WINDOW,
  DEFAULT_TABBYAPI_MAX_TOKENS,
  DEFAULT_TABBYAPI_MODEL,
  DEFAULT_THINKING_BUDGETS,
} from './config.js'
import { DEFAULT_TRIM_KNOBS } from './prepare.js'

/** The settings namespace this plugin owns. */
export const NS = 'qwen38-local-qol'

/**
 * The per-dialect line block. Each server line (llama.cpp, NInfer, TabbyAPI) remembers
 * its own connection (`baseURL`/`model`/`displayName`) and its own window
 * numbers (`contextWindow`/`maxTokens`/`thinkingBudgets`): the context window
 * is a property of the line's server build (its `-c`, bounded by that line's
 * VRAM and quantization), not of the model — two lines of the same model may
 * legitimately carry different windows, and a shared window would
 * miscalibrate the compaction threshold of the smaller one. The top-level
 * `baseURL`/`model`/`displayName`/`contextWindow`/`maxTokens`/`thinkingBudgets`
 * plus `defaultThinkingBudget` and `summarize` stay authoritative at the top
 * level for the adapter and the compaction backend (the tab writes them in sync
 * with the active line); `lines` is the per-dialect memory the tab swaps
 * between — including the thinking budget (a property of the line's server
 * build, e.g. NInfer's `--default-thinking-budget`) and the trim knobs (a
 * per-line preference).
 */
function lineSchema(baseURL, model, contextWindow, maxTokens, budgets) {
  return Schema.object({
    baseURL: Schema.string().default(baseURL),
    model: Schema.string().default(model),
    displayName: Schema.string().default(''),
    // This line's own server credential (empty = keyless). The tab persists
    // one per line; the top-level `apiKey` mirrors the ACTIVE line and is
    // what the adapter sends (Authorization: Bearer).
    apiKey: Schema.string().default(''),
    contextWindow: Schema.number().default(contextWindow),
    maxTokens: Schema.number().default(maxTokens),
    thinkingBudgets: Schema.object({
      low: Schema.number().default(budgets.low),
      medium: Schema.number().default(budgets.medium),
      xhigh: Schema.number().default(budgets.xhigh),
    }),
    defaultThinkingBudget: Schema.number().default(16384),
    summarize: Schema.object({
      images: Schema.string().default(DEFAULT_TRIM_KNOBS.images),
      keepTurns: Schema.number().default(DEFAULT_TRIM_KNOBS.keepTurns),
      toolChars: Schema.number().default(DEFAULT_TRIM_KNOBS.toolChars),
    }),
  })
}

/**
 * Build the namespace schema. Field names match the `resolveConfig` output so
 * a resolved value is directly consumable by the adapter; unknown keys pass
 * through, so a row base carrying extra keys (e.g. `provider`) stays intact.
 * @returns the schemastery object schema for the section.
 */
export function sectionSchema() {
  return Schema.object({
    dialect: Schema.string().default(DIALECT_LLAMACPP),
    baseURL: Schema.string().default(DEFAULT_LLAMA_BASE_URL),
    model: Schema.string().default(DEFAULT_LLAMA_MODEL),
    displayName: Schema.string().default(''),
    lines: Schema.object({
      ninfer: lineSchema(DEFAULT_BASE_URL, DEFAULT_MODEL, DEFAULT_CONTEXT_WINDOW, DEFAULT_MAX_TOKENS, DEFAULT_THINKING_BUDGETS),
      llamacpp: lineSchema(DEFAULT_LLAMA_BASE_URL, DEFAULT_LLAMA_MODEL, DEFAULT_CONTEXT_WINDOW, DEFAULT_MAX_TOKENS, DEFAULT_THINKING_BUDGETS),
      tabbyapi: lineSchema(DEFAULT_TABBYAPI_BASE_URL, DEFAULT_TABBYAPI_MODEL, DEFAULT_TABBYAPI_CONTEXT_WINDOW, DEFAULT_TABBYAPI_MAX_TOKENS, DEFAULT_THINKING_BUDGETS),
    }),
    apiKey: Schema.string().default(''),
    contextWindow: Schema.number().default(DEFAULT_CONTEXT_WINDOW),
    maxTokens: Schema.number().default(DEFAULT_MAX_TOKENS),
    thinkingBudgets: Schema.object({
      low: Schema.number().default(DEFAULT_THINKING_BUDGETS.low),
      medium: Schema.number().default(DEFAULT_THINKING_BUDGETS.medium),
      xhigh: Schema.number().default(DEFAULT_THINKING_BUDGETS.xhigh),
    }),
    defaultThinkingBudget: Schema.number().default(16384),
    defaultEffort: Schema.string().default('medium'),
    thinkingLevelMap: Schema.dict(Schema.string()).default({}),
    includeUsage: Schema.boolean().default(true),
    summarize: Schema.object({
      images: Schema.string().default(DEFAULT_TRIM_KNOBS.images),
      keepTurns: Schema.number().default(DEFAULT_TRIM_KNOBS.keepTurns),
      toolChars: Schema.number().default(DEFAULT_TRIM_KNOBS.toolChars),
    }),
    // The compaction wiring status the tab renders (the host reads it at boot
    // into the section base): the trim controls apply only to sessions using
    // the qwen38 preset, so the tab states which preset new sessions take.
    compaction: Schema.object({
      presetGenerated: Schema.boolean().default(false),
      defaultPreset: Schema.string().default('standard'),
    }),
  })
}

/**
 * Cross-field validation for a resolved section the schema alone cannot
 * express. Fails loud so a bad tab write is refused at the write, not met
 * mid-request.
 * @param value - the resolved section, schema-valid by construction.
 * @throws {Error} when a field combination the adapter cannot serve.
 */
export function validateSection(value) {
  if (DIALECTS.includes(value.dialect) === false) {
    throw new Error(`dsh-qwen38-local-qol: dialect must be one of ${DIALECTS.map((d) => `"${d}"`).join(', ')}, got "${value.dialect}"`)
  }
  const budgets = value.thinkingBudgets ?? {}
  for (const [effort, budgetTokens] of Object.entries(budgets)) {
    if (!Number.isInteger(budgetTokens) || budgetTokens <= 0) {
      throw new Error(`dsh-qwen38-local-qol: thinkingBudgets["${effort}"] must be a positive integer, got ${String(budgetTokens)}`)
    }
  }
  if (!Number.isInteger(value.defaultThinkingBudget) || value.defaultThinkingBudget <= 0) {
    throw new Error(`dsh-qwen38-local-qol: defaultThinkingBudget must be a positive integer, got ${String(value.defaultThinkingBudget)}`)
  }
  // The per-line memory carries the same window numbers; validate each line
  // so a hand-edited document cannot park a bad number that later goes live.
  for (const [lineName, line] of Object.entries(value.lines ?? {})) {
    if (line === undefined || line === null || typeof line !== 'object') continue
    for (const knob of ['contextWindow', 'maxTokens']) {
      const raw = line[knob]
      if (!Number.isInteger(raw) || raw <= 0) {
        throw new Error(`dsh-qwen38-local-qol: lines.${lineName}.${knob} must be a positive integer, got ${String(raw)}`)
      }
    }
    for (const [effort, budgetTokens] of Object.entries(line.thinkingBudgets ?? {})) {
      if (!Number.isInteger(budgetTokens) || budgetTokens <= 0) {
        throw new Error(`dsh-qwen38-local-qol: lines.${lineName}.thinkingBudgets["${effort}"] must be a positive integer, got ${String(budgetTokens)}`)
      }
    }
    const lineDefaultBudget = line.defaultThinkingBudget
    if (!Number.isInteger(lineDefaultBudget) || lineDefaultBudget <= 0) {
      throw new Error(`dsh-qwen38-local-qol: lines.${lineName}.defaultThinkingBudget must be a positive integer, got ${String(lineDefaultBudget)}`)
    }
    const lineImages = line.summarize?.images
    if (lineImages !== 'strip' && lineImages !== 'keep') {
      throw new Error(`dsh-qwen38-local-qol: lines.${lineName}.summarize.images must be "strip" or "keep", got "${lineImages}"`)
    }
    for (const knob of ['keepTurns', 'toolChars']) {
      const raw = line.summarize?.[knob]
      if (!Number.isInteger(raw) || raw < 0) {
        throw new Error(`dsh-qwen38-local-qol: lines.${lineName}.summarize.${knob} must be a non-negative integer, got ${String(raw)}`)
      }
    }
  }
  if (value.defaultEffort !== 'off' && budgets[value.defaultEffort] === undefined) {
    throw new Error(`dsh-qwen38-local-qol: defaultEffort "${value.defaultEffort}" is not a declared effort ("off" + thinkingBudgets keys)`)
  }
  const images = value.summarize?.images
  if (images !== 'strip' && images !== 'keep') {
    throw new Error(`dsh-qwen38-local-qol: summarize.images must be "strip" or "keep", got "${images}"`)
  }
  for (const knob of ['keepTurns', 'toolChars']) {
    const raw = value.summarize?.[knob]
    if (!Number.isInteger(raw) || raw < 0) {
      throw new Error(`dsh-qwen38-local-qol: summarize.${knob} must be a non-negative integer, got ${String(raw)}`)
    }
  }
  // The status fields ride the section base; a hand-edited document must not
  // park a non-boolean flag or an empty preset id the tab would render.
  if (typeof value.compaction?.presetGenerated !== 'boolean') {
    throw new Error(`dsh-qwen38-local-qol: compaction.presetGenerated must be a boolean, got ${String(value.compaction?.presetGenerated)}`)
  }
  if (typeof value.compaction?.defaultPreset !== 'string' || value.compaction.defaultPreset.trim() === '') {
    throw new Error(`dsh-qwen38-local-qol: compaction.defaultPreset must be a non-empty string, got ${String(value.compaction?.defaultPreset)}`)
  }
}
