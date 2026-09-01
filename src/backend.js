/**
 * The Qwen3.8 local-line compaction backend: the stock basic compaction
 * engine with its sole summarization hook overridden so the summarizer
 * prefill is trimmed before the one-shot call (recent reasoning only, images
 * stripped, tool results capped). The trim keeps the auxiliary call's input
 * bounded so a slow local model does not idle out under the stream watchdog,
 * and the fixed `reasoningEffort: off` the engine sends keeps the whole output
 * cap available for the checkpoint instead of burning it on thinking.
 *
 * Mounted as a service row in the generated user preset
 * (`~/.dsh/.agent-presets/qwen38-qol/agent.cordis.yml`, via
 * {@link dsh-qwen38-local-qol/setup}), inside the preset's isolated compaction
 * group. The row config is the stock `BasicCompactionConfig`; the only
 * recommended row value is `maxTokens: 16384` (the stock 8192 default is the
 * cap that thinking used to eat). The trim knobs come from the user-settings
 * section (the Settings tab's `summarize` block) when that namespace is
 * registered, else from environment variables (see {@link resolveTrimKnobs})
 * so the row carries no keys the stock config schema does not know.
 *
 * @module dsh-qwen38-local-qol/backend
 */
import BasicCompactionEngine from '@deepseek-ai/dsh-compaction-basic'
import { prepareSummaryRegion, resolveTrimKnobs, DEFAULT_TRIM_KNOBS } from './prepare.js'
import { NS } from './settings-section.js'

/**
 * Basic compaction with a trimmed summarizer prefill.
 */
export class QwenLocalCompaction extends BasicCompactionEngine {
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
    // layer. The read is direct (no private members) so prototype-only
    // receivers keep working.
    const settings = typeof this.ctx?.get === 'function' ? this.ctx.get('settings') : undefined
    const section = typeof settings?.get === 'function' ? settings.get(NS) : undefined
    const sectionKnobs = section?.summarize
    const knobs = sectionKnobs !== undefined && typeof sectionKnobs === 'object'
      ? { ...DEFAULT_TRIM_KNOBS, ...sectionKnobs }
      : resolveTrimKnobs(process.env)
    const prepared = prepareSummaryRegion(input.messages, knobs)
    return super.summarize({ ...input, messages: prepared }, agent, signal)
  }
}

export default QwenLocalCompaction
