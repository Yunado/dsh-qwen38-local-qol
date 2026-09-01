/**
 * DeepSeek Harness plugin registering the Qwen3.8 local-line backend on the
 * `llm` seam.
 *
 * This is an LLM adapter, not a tool: it registers a provider route with
 * `ctx.llm.registerAdapter()` and never touches `ctx.tools`. The companion
 * compaction backend lives in {@link dsh-qwen38-local-qol/backend} and is
 * mounted by the generated user preset, not by this bundle patch.
 *
 * @module dsh-qwen38-local-qol
 */
import { QwenLocalAdapter } from './adapter.js'
import { resolveConfig, DEFAULT_PROVIDER } from './config.js'
import { NS, sectionSchema, validateSection } from './settings-section.js'

export { QwenLocalAdapter, PROVIDER_NAME, PROVIDER_HTTP_ERROR_CODE, PROVIDER_UNREACHABLE_CODE } from './adapter.js'
export {
  UNSUPPORTED_CONTENT_CODE,
  PROVIDER_PROTOCOL_ERROR_CODE,
  PROVIDER_ERROR_CODE,
} from './wire.js'
export { resolveConfig, DEFAULT_BASE_URL, DEFAULT_MODEL, DEFAULT_PROVIDER } from './config.js'

/** Plugin name, as it appears in the harness plugin registry. */
export const name = 'qwen38-local-qol'

/** Hard dependency: without the `llm` seam there is nothing to register on. */
export const inject = ['llm']

/**
 * Register the Qwen3.8 local adapter for its configured provider routes.
 * @param ctx - the harness context, with the injected `llm` seam.
 * @param config - the plugin config; see {@link resolveConfig}.
 * @returns the registration handle, released with the fiber.
 */
export function apply(ctx, config = {}) {
  const resolved = resolveConfig(config)
  let current = () => resolved
  let attachment
  // The user-settings seam is a declared injection, not a store read: every
  // dsh profile mounts a settings provider (the base bundle's settings-file
  // row), and `ctx.inject` waits for it. A `ctx.get('settings')` read races the
  // boot order — when this apply ran first, the section silently never
  // installed and the host settings surface had no namespace to write. The
  // fully resolved row is the base: the installSection detach fallback is the
  // base value verbatim, so it must already carry every field.
  ctx.inject(['settings'], (settingsCtx) => {
    settingsCtx.settings.installSection(ctx, NS, sectionSchema(), resolved, {
      setSource: (source) => { current = source },
      onChange: () => {},
      validate: validateSection,
    })
  })
  // The attachment seam is optional (the tool-fs precedent): where the profile
  // has no attachment store the child fiber stays pending and image blocks
  // degrade to text placeholders for the process lifetime.
  ctx.inject(['attachments'], (attachmentCtx) => {
    attachment = attachmentCtx.attachments
  })
  const adapter = new QwenLocalAdapter(() => ({ ...current(), attachment }))
  return ctx.llm.registerAdapter(resolved.provider, adapter)
}
