/**
 * Plugin configuration resolution: patch row first, then `DSH_QWEN38_*`
 * environment variables, then built-in defaults matching the production
 * Qwen3.8-27B line (NInfer 0.5.0 on 8082, 224K context).
 *
 * @module dsh-qwen38-local-qol/config
 */

/** Where the production NInfer 0.5.0 server listens, plus its OpenAI path prefix. */
export const DEFAULT_BASE_URL = 'http://127.0.0.1:8082/v1'

/** Model id sent when nothing configures one; matches the server alias. */
export const DEFAULT_MODEL = 'qwen3.8-27b-nvfp4-uncensored'

/** Where the standby llama.cpp line listens (the production 8080 bat). */
export const DEFAULT_LLAMA_BASE_URL = 'http://127.0.0.1:8080/v1'

/**
 * Standby llama line model id: the GGUF basename (llama-server's default
 * OpenAI alias for `-m <file>` with no `--alias` override).
 */
export const DEFAULT_LLAMA_MODEL = 'Huihui-Qwen3.8-27B-abliterated-UD-Q5_K_XL'

/** The single provider route this plugin registers unless configured otherwise. */
export const DEFAULT_PROVIDER = 'qwen38'

/**
 * Server dialect of the local Qwen3.8 line. `ninfer` = NInfer serve (effort
 * travels as the top-level `reasoning_effort` body field); `llamacpp` =
 * llama-server with the froggeric v22.1 jinja template (effort travels as
 * `chat_template_kwargs.reasoning_effort`, hard budget as
 * `reasoning_budget_tokens`).
 */
export const DIALECT_NINFER = 'ninfer'
export const DIALECT_LLAMACPP = 'llamacpp'

/** Context window of the production 224K line (229376). */
export const DEFAULT_CONTEXT_WINDOW = 229376

/** Output cap of the production line (229376 - 204800, the narrow-band floor). */
export const DEFAULT_MAX_TOKENS = 24576

/** Per-effort hard thinking budgets of the production line. */
export const DEFAULT_THINKING_BUDGETS = Object.freeze({
  low: 4096,
  medium: 8192,
  xhigh: 16384,
})

/**
 * Read one non-empty string setting, preferring the patch row over the
 * environment. An empty or whitespace-only value counts as unset.
 * @param value - the configured value.
 * @param envValue - the environment fallback.
 * @param fallback - the built-in default.
 * @returns the resolved setting.
 */
function setting(value, envValue, fallback) {
  for (const candidate of [value, envValue]) {
    if (typeof candidate === 'string' && candidate.trim() !== '') return candidate.trim()
  }
  return fallback
}

/**
 * Read one positive-integer setting, preferring the patch row over the
 * environment. Non-integer or non-positive values fall through to the next
 * candidate; all of them failing falls back to the built-in default.
 * @param value - the configured value.
 * @param envValue - the environment fallback.
 * @param fallback - the built-in default.
 * @returns the resolved integer.
 */
function intSetting(value, envValue, fallback) {
  for (const candidate of [value, envValue]) {
    if (typeof candidate === 'number' && Number.isInteger(candidate) && candidate > 0) return candidate
    if (typeof candidate === 'string' && /^\d+$/.test(candidate.trim())) {
      const parsed = Number.parseInt(candidate.trim(), 10)
      if (parsed > 0) return parsed
    }
  }
  return fallback
}

/**
 * Read the per-effort thinking-budget map. Each entry must be a positive
 * integer; malformed entries are dropped so one bad key cannot poison the map.
 * @param value - the configured map.
 * @param fallback - the built-in default map.
 * @returns a new map with only the valid entries, or the fallback when nothing valid remains.
 */
function budgetMap(value, fallback) {
  if (value === undefined || value === null || typeof value !== 'object') return { ...fallback }
  const out = {}
  for (const [effort, budget] of Object.entries(value)) {
    if (typeof budget === 'number' && Number.isInteger(budget) && budget > 0) out[effort] = budget
  }
  return Object.keys(out).length > 0 ? out : { ...fallback }
}

/**
 * Resolve plugin configuration. Note that an id-targeted cordis patch
 * replaces the whole config object, so the environment fallbacks apply to
 * whichever fields that patch leaves out.
 * @param config - the plugin config supplied by the bundle patch or overlay.
 * @param env - environment to read; defaults to `process.env`.
 * @returns the resolved provider configuration.
 */
export function resolveConfig(config = {}, env = process.env) {
  const dialect = setting(config.dialect, env.DSH_QWEN38_DIALECT, DIALECT_LLAMACPP)
  if (dialect !== DIALECT_NINFER && dialect !== DIALECT_LLAMACPP) {
    throw new Error(`dsh-qwen38-local-qol: dialect must be "${DIALECT_NINFER}" or "${DIALECT_LLAMACPP}", got "${dialect}"`)
  }
  const provider = Array.isArray(config.provider)
    ? config.provider.map((route) => String(route).trim()).filter((route) => route !== '')
    : [DEFAULT_PROVIDER]

  const contextWindow = intSetting(config.contextWindow, env.DSH_QWEN38_CONTEXT_WINDOW, DEFAULT_CONTEXT_WINDOW)
  const maxTokens = intSetting(config.maxTokens, env.DSH_QWEN38_MAX_TOKENS, DEFAULT_MAX_TOKENS)
  const thinkingBudgets = budgetMap(config.thinkingBudgets, DEFAULT_THINKING_BUDGETS)
  const defaultEffort = setting(config.defaultEffort, env.DSH_QWEN38_DEFAULT_EFFORT, 'medium')
  if (defaultEffort !== 'off' && thinkingBudgets[defaultEffort] === undefined) {
    throw new Error(`dsh-qwen38-local-qol: defaultEffort "${defaultEffort}" is not a declared effort ("off" + thinkingBudgets keys)`)
  }

  return {
    baseURL: setting(config.baseURL, env.DSH_QWEN38_BASE_URL, DEFAULT_BASE_URL),
    model: setting(config.model, env.DSH_QWEN38_MODEL, DEFAULT_MODEL),
    /**
     * Human-readable selector name for the model entry. The wire model id is
     * an artifact alias (e.g. `qwen3.8-27b-nvfp4-uncensored`); the display
     * name is what the GUI selector shows. Unset falls back to the model id.
     */
    displayName: setting(config.displayName, env.DSH_QWEN38_DISPLAY_NAME, undefined),
    apiKey: setting(config.apiKey, env.DSH_QWEN38_API_KEY, undefined),
    dialect,
    contextWindow,
    maxTokens,
    thinkingBudgets,
    /**
     * The selectable effort materialized into requests that omit one, and the
     * selector fallback. Declaring it suppresses the core selector's
     * "Default" row (which is redundant with `off` on this line).
     */
    defaultEffort,
    thinkingLevelMap: config.thinkingLevelMap && typeof config.thinkingLevelMap === 'object'
      ? Object.fromEntries(Object.entries(config.thinkingLevelMap).filter((entry) => typeof entry[1] === 'string'))
      : {},
    /**
     * Ask the server to report usage in the final stream frame. On by default
     * for both dialects: the context-pressure projection (the session's
     * context meter) and the per-turn reasoning-token display both read the
     * server-reported usage. Verified 2026-09 against NInfer 0.5.0 (accepts
     * `stream_options.include_usage` and reports `usage`, including
     * `completion_tokens_details.reasoning_tokens`); llama-server honors it.
     */
    includeUsage: typeof config.includeUsage === 'boolean'
      ? config.includeUsage
      : true,
    provider: provider.length > 0 ? provider : [DEFAULT_PROVIDER],
  }
}
