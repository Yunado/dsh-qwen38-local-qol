/**
 * DeepSeek Harness plugin registering the Qwen3.8 local-line backend on the
 * `llm` seam.
 *
 * This is an LLM adapter, not a tool: it registers a provider route with
 * `ctx.llm.registerAdapter()` and never touches `ctx.tools`. The companion
 * compaction backend lives in {@link dsh-qwen38-local-qol/backend} and is
 * mounted by the qwen38 agent preset this bundle's patch declares.
 *
 * Configuration lives on the plugin row (the profile's plugin-config store
 * since dsh 0.2.0): every leaf of {@link Config} is `.volatile()`, an edit
 * commits into the running config reference and emits `loader/volatile-update`
 * without remounting this fiber, and the adapter re-reads its resolved view
 * per request, so a saved change serves the next wire call without a restart.
 *
 * @module dsh-qwen38-local-qol
 */
import { QwenLocalAdapter } from './adapter.js'
import { resolveConfig } from './config.js'
import { Config, liveConfigView, publishLiveConfig, validateSection } from './settings-section.js'

export { QwenLocalAdapter, PROVIDER_NAME, PROVIDER_HTTP_ERROR_CODE, PROVIDER_UNREACHABLE_CODE } from './adapter.js'
export {
  UNSUPPORTED_CONTENT_CODE,
  PROVIDER_PROTOCOL_ERROR_CODE,
  PROVIDER_ERROR_CODE,
} from './wire.js'
export { resolveConfig, DEFAULT_BASE_URL, DEFAULT_MODEL, DEFAULT_PROVIDER } from './config.js'
export { Config } from './settings-section.js'

/** Plugin name, as it appears in the harness plugin registry. */
export const name = 'qwen38-local-qol'

/** Hard dependency: without the `llm` seam there is nothing to register on. */
export const inject = ['llm']

/**
 * Register the Qwen3.8 local adapter for its configured provider routes.
 * @param ctx - the harness context, with the injected `llm` seam.
 * @param config - the live plugin config reference; see {@link resolveConfig}.
 * @returns the registration handle, released with the fiber.
 */
export function apply(ctx, config = {}) {
  const resolved = resolveConfig(config)
  // Publish this row's live config reference for the compaction backend (a
  // preset-fiber service that cannot reach this row through the 0.2.0 settings
  // service - see settings-section's mirror docs). Stored wrapped: the backend
  // resolves each volatile leaf per read, so hot commits need no republish.
  publishLiveConfig(config)
  if (typeof ctx.effect === 'function') {
    ctx.effect(() => () => {
      // A disposed row falls back to the row base instead of leaving a stale
      // mirror; a newer mount's reference is never cleared by an older fiber.
      if (liveConfigView() === config) publishLiveConfig(undefined)
    })
  }
  // The Settings surface: this plugin ships its own page (the browser half
  // registers a `settings.section`), so opt the auto-generated Config form
  // off for this entry - otherwise the host would render a second editor
  // over the same store (the llm-deepseek / locale configure precedent).
  ctx.inject(['settings'], (settingsCtx) => {
    settingsCtx.effect(() => settingsCtx.settings.configure({ auto: false }, ctx.fiber))
  })
  // The attachment seam is optional (the tool-fs precedent): where the
  // profile has no attachment store the child fiber stays pending and image
  // blocks degrade to text placeholders for the process lifetime.
  let attachment
  ctx.inject(['attachments'], (attachmentCtx) => {
    attachment = attachmentCtx.attachments
  })
  // Per-request resolution off the live config reference: a volatile commit
  // (a settings-form save) is visible on the very next request; no source
  // plumbing, no restart.
  const adapter = new QwenLocalAdapter(() => ({ ...resolveConfig(config), attachment }))
  // Loud-but-non-fatal cross-field validation after each hot edit: the
  // schema cannot express every invariant, and a bad combination must show
  // up in the host log at the write, not mid-request. The values are already
  // committed by the loader, so this warns; the adapter's own per-request
  // guards still refuse what it cannot serve.
  let lastWarned
  // The catalog fields the browser's model menu caches (id, display name,
  // capacity, selectable efforts). A volatile commit mutates the adapter but
  // never re-registers, so without a `replace` the open pages keep showing the
  // pre-switch model - the llm-deepseek dynamic-config precedent: compare the
  // advertised snapshot and re-register (which publishes
  // `llm/adapters-updated`, refreshing every selector) only when it changed.
  const advertised = () => {
    const resolvedNow = resolveConfig(config)
    return JSON.stringify([resolvedNow.provider, resolvedNow.model, resolvedNow.displayName,
      resolvedNow.contextWindow, resolvedNow.maxTokens, resolvedNow.thinkingBudgets, resolvedNow.defaultEffort])
  }
  let published = advertised()
  ctx.on('loader/volatile-update', () => {
    try {
      // Validate the schema-shaped config (the host parse fills every
      // default), so the per-line memory is covered too, not just the active view.
      validateSection(config)
      lastWarned = undefined
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      if (message !== lastWarned) {
        lastWarned = message
        ctx.logger?.warn?.(message)
      }
      // A refused combination also stops the catalog re-advertisement: the
      // adapter refuses to serve it per request anyway, and the next valid
      // commit re-syncs the menus.
      return
    }
    try {
      const next = advertised()
      if (next === published) return
      // `resolved.provider` is the route array itself; replace() takes routes.
      registration.replace(resolved.provider)
      published = next
    } catch (error) {
      ctx.logger?.warn?.(`dsh-qwen38-local-qol: re-advertising the model catalog failed: ${error instanceof Error ? error.message : String(error)}`)
    }
  })
  const registration = ctx.llm.registerAdapter(resolved.provider, adapter)
  return registration
}
