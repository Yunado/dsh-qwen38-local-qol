/**
 * Browser half: the "Qwen3.8 Local" settings tab.
 *
 * One page in the host's settings dialog, beside the other sections. It
 * reads and writes the plugin's user-settings namespace through the settings
 * Remote: `describe()` for the current value, revision, and writability;
 * `update()` with the held revision for a write, folding the answered view
 * back so a concurrent editor (the settings document on disk, another
 * browser) is surfaced as a conflict and re-read, never silently overwritten.
 *
 * Styled the way the host's own settings sections are: the shared
 * `@deepseek-ai/dsh-client-ui-primitives` controls (Button, Input, Switch,
 * StateDot) and the `--dsw-alias-*` design tokens; the page sheet is
 * `client.css` (`qol-` prefixed classes, no CSS Modules) which the browser
 * entry (`client-entry.js`) injects once as a `<style>` tag.
 *
 * The source is `React.createElement` (no JSX) and is built by
 * `scripts/build-client.mjs` (esbuild entry `src/client-entry.js`, `react`
 * and the primitives package left external — the module table supplies both
 * identities) into the DSH client-module format — a self-registering classic
 * script — committed as `lib/client.js`. The dialect selector is the headline
 * control — it switches the server line (llama-server vs NInfer vs TabbyAPI,
 * the ExLlamaV3 backend) for every request the plugin route serves.
 *
 * @module dsh-qwen38-local-qol/client
 */
import * as React from 'react'
import { Button, Input, StateDot, Switch } from '@deepseek-ai/dsh-client-ui-primitives'

/** The settings namespace this tab edits (mirrors the host's `NS`). */
const NS = 'qwen38-local-qol'

/** The generated preset id (mirrors the host's `PRESET_ID`). */
const PRESET_ID = 'qwen38'

/** Password-reveal icons: an open eye while revealed, a slashed eye while concealed. */
const EYE_OPEN = React.createElement('svg', { width: 15, height: 15, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', ariaHidden: true },
  React.createElement('path', { d: 'M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z' }),
  React.createElement('circle', { cx: 12, cy: 12, r: 3 }))
const EYE_CLOSED = React.createElement('svg', { width: 15, height: 15, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', ariaHidden: true },
  React.createElement('path', { d: 'M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.17 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24' }),
  React.createElement('line', { x1: 1, y1: 1, x2: 23, y2: 23 }))

const COPY = {
  en: {
    title: 'Qwen3.8 Local',
    line: 'Server line',
    dialectNinfer: 'NInfer',
    dialectLlamacpp: 'llama.cpp',
    dialectTabbyapi: 'TabbyAPI',
    dialectOmlx: 'oMLX',
    connection: 'Connection',
    baseURL: 'Server base URL',
    model: 'Model id',
    displayName: 'Display name',
    apiKey: 'API key',
    apiKeyHint: 'Empty = keyless. When set, requests carry Authorization: Bearer <key>.',
    revealKey: 'Reveal the stored key',
    concealKey: 'Conceal the stored key',
    window: 'Window and output',
    contextWindow: 'Context window (tokens)',
    maxTokens: 'Output cap (tokens)',
    thinking: 'Thinking budgets',
    thinkingAll: 'All efforts',
    thinkingHintNinfer: 'NInfer reads its thinking budget at server startup (--default-thinking-budget); a per-request budget is not supported (ninfer as of 2026-09-14; ninfer-windows 0.7.1). Change the startup flag and restart the server.',
    thinkingHintLlamacpp: 'Thinking hard cap, sent per request per selected level (overrides the server\'s --reasoning-budget flag).',
    thinkingHintTabbyapi: 'Thinking hard cap, sent per request per selected level (TabbyAPI native reasoning_budget_tokens).',
    thinkingHintOmlx: 'Thinking hard cap, sent per request per selected level (oMLX native thinking_budget).',
    compaction: 'Compaction prefill trim',
    summarizeImages: 'Images in the summarizer prefill',
    summarizeHint: 'Off strips images in the summarizer prefill to text placeholders (prefer with mmproj offload).',
    keepTurns: 'Keep reasoning of the last N turns',
    toolChars: 'Tool-result character cap (0 = off)',
    save: 'Save',
    saving: 'Saving…',
    saved: 'Saved',
    loading: 'Loading…',
    notFound: 'This plugin is not registered a settings section on the host side (restart DSH web after installing the plugin, then open this page again).',
    conflict: 'Someone else changed these settings while you were editing. Your edits were discarded; the current values are shown.',
    invalidNumber: 'Every number field must be a positive whole number.',
    remoteError: 'Settings request failed: ',
    compactionNotSet: 'Local compaction is not set up — the trim controls below apply once the qwen38 preset is generated (one-time setup, see the plugin README).',
    compactionActive: 'Local compaction is active for new sessions (default preset: qwen38).',
    compactionAvailable: 'Local compaction is available, but the default preset is "{default}" — new sessions use standard compaction. Select qwen38 on the Agent presets page to enable it.',
    compactionHint: 'The trim controls apply to sessions using the qwen38 preset.',
  },
  zh: {
    title: 'Qwen3.8 本地',
    line: '服务器线',
    dialectNinfer: 'NInfer',
    dialectLlamacpp: 'llama.cpp',
    dialectTabbyapi: 'TabbyAPI',
    dialectOmlx: 'oMLX',
    connection: '连接',
    baseURL: '服务器地址',
    model: '模型 id',
    displayName: '显示名',
    apiKey: '接口密钥（API key）',
    apiKeyHint: '留空 = 无认证；填写后请求带 Authorization: Bearer <key>。',
    revealKey: '显示已存的密钥',
    concealKey: '隐藏已存的密钥',
    window: '窗口与输出',
    contextWindow: '上下文窗口（token）',
    maxTokens: '输出上限（token）',
    thinking: 'Thinking 预算',
    thinkingAll: '全部 effort',
    thinkingHintNinfer: 'NInfer 的 thinking 预算在服务启动时设定（--default-thinking-budget 启动参数，不支持逐请求，ninfer as of 2026-09-14；ninfer-windows 0.7.1）。改启动参数后重启服务生效。',
    thinkingHintLlamacpp: 'thinking 硬帽，逐请求按所选档发送（覆盖服务端 --reasoning-budget）。',
    thinkingHintTabbyapi: 'thinking 硬帽，逐请求按所选档发送（TabbyAPI 原生 reasoning_budget_tokens）。',
    thinkingHintOmlx: 'thinking 硬帽，逐请求按所选档发送（oMLX 原生 thinking_budget）。',
    compaction: '压缩预填充裁剪',
    summarizeImages: '摘要预填充里的图片',
    summarizeHint: '关闭 = 摘要预填充里的图片替换为文本占位符（mmproj offload 时优选）。',
    keepTurns: '保留最近 N 轮的 reasoning',
    toolChars: '工具结果字数帽（0 = 关）',
    save: '保存',
    saving: '保存中…',
    saved: '已保存',
    loading: '加载中…',
    notFound: '宿主侧未注册该插件的设置命名空间（装完插件后重启 DSH web，再打开本页面）。',
    conflict: '编辑期间他人修改了这些设置。你的改动已丢弃，当前显示的是最新值。',
    invalidNumber: '所有数字字段必须是正整数。',
    remoteError: '设置请求失败：',
    compactionNotSet: '本地压缩未启用——生成 qwen38 预设（一次性 setup，见插件 README）后，下方裁剪设置才会生效。',
    compactionActive: '本地压缩对新会话生效（默认预设：qwen38）。',
    compactionAvailable: '本地压缩可用，但默认预设是 "{default}"——新会话走标准压缩。在 Agent 预设页选择 qwen38 启用。',
    compactionHint: '裁剪设置仅对 qwen38 预设的会话生效。',
  },
}

/**
 * The compaction wiring status line for the settings tab: whether the local
 * compaction backend is actually reachable by new sessions.
 * @param status - the host-computed `{ presetGenerated, defaultPreset }`
 *   (undefined when the section predates the status field).
 * @param t - the locale copy.
 * @returns the status sentence (the available state substitutes the preset id).
 */
export function compactionStatusCopy(status, t) {
  if (status === undefined || status.presetGenerated !== true) return t.compactionNotSet
  if (status.defaultPreset === PRESET_ID) return t.compactionActive
  return t.compactionAvailable.replace('{default}', String(status.defaultPreset))
}

/**
 * The StateDot state of the compaction wiring line, so the state reads at a
 * glance instead of parsing the sentence: green done when the local
 * compaction preset is the default, amber warning when the preset exists but
 * is not the default, grey idle when it has not been generated.
 * @param status - the host-computed `{ presetGenerated, defaultPreset }`.
 * @returns the `StateDot` state ('done' | 'warning' | 'idle').
 */
export function compactionStatusState(status) {
  if (status === undefined || status.presetGenerated !== true) return 'idle'
  if (status.defaultPreset === PRESET_ID) return 'done'
  return 'warning'
}

/** One editable field row: the host field pattern — a 12px label over a control. */
function Field({ label, children }) {
  return React.createElement('div', { className: 'qol-field' },
    React.createElement('label', { className: 'qol-fieldLabel' }, label),
    children)
}

/**
 * Digit-only onChange for the numeric fields: strips anything that is not a
 * 0-9 character as it is typed (covers typing and paste), so an input never
 * holds text the save-time integer check would reject.
 * @param setValue - receives the filtered value.
 * @returns the onChange handler.
 */
function digitsOnly(setValue) {
  return (e) => { setValue(e.target.value.replace(/\D/g, '')) }
}

/**
 * The built-in window defaults per line, mirroring `resolveConfig`: every
 * standard line opens on a 256K context with the ~20%-of-window output cap
 * (headroom for the compaction trigger at 0.8× contextWindow).
 */
const LINE_WINDOW_DEFAULTS = Object.freeze({
  ninfer: { contextWindow: 262144, maxTokens: 52428 },
  llamacpp: { contextWindow: 262144, maxTokens: 52428 },
  tabbyapi: { contextWindow: 262144, maxTokens: 52428 },
  omlx: { contextWindow: 64000, maxTokens: 16384 },
})

/**
 * Read one line's editable record. `fallback` is the section's top-level
 * values, passed only for the active line of a legacy write (the top level
 * belongs to that line), layered under the persisted line over the built-in
 * defaults.
 * @param name - the dialect the record belongs to.
 * @param raw - the persisted line record, when the section carries one.
 * @param fallback - the legacy top-level values, or undefined.
 * @returns the flat record for the tab's inputs.
 */
function lineRecord(name, raw, fallback) {
  const d = LINE_WINDOW_DEFAULTS[name]
  const src = { contextWindow: d.contextWindow, maxTokens: d.maxTokens, ...(fallback ?? {}), ...(raw ?? {}) }
  return {
    baseURL: src.baseURL ?? '',
    model: src.model ?? '',
    displayName: src.displayName ?? '',
    apiKey: src.apiKey ?? '',
    contextWindow: String(src.contextWindow ?? d.contextWindow),
    maxTokens: String(src.maxTokens ?? d.maxTokens),
    low: String(src.thinkingBudgets?.low ?? 4096),
    medium: String(src.thinkingBudgets?.medium ?? 8192),
    xhigh: String(src.thinkingBudgets?.xhigh ?? 16384),
    defaultThinkingBudget: String(src.defaultThinkingBudget ?? 16384),
    images: src.summarize?.images ?? 'strip',
    keepTurns: String(src.summarize?.keepTurns ?? 5),
    toolChars: String(src.summarize?.toolChars ?? 2000),
  }
}

/**
 * Pull the editable draft out of a namespace view's resolved value.
 *
 * The connection fields are per-dialect (`lines`): the draft lifts the active
 * line into the flat inputs and parks EVERY line under `lines`, so the
 * dialect control swaps the active line from the parked records and each
 * line remembers its own values across switches. Sections saved before
 * `lines` existed carry the values only at the top level — detect that from
 * the user layer and migrate the top level into the active line instead of
 * showing the schema defaults on top of the user's saved values.
 *
 * The numeric fields fall back to the production line's values so a fresh
 * install (no user layer) is fill-once: only the connection fields may be
 * empty of meaning, everything else ships pre-filled.
 */
export function toDraft(value) {
  const dialect = value.dialect
  const legacy = (value.user ?? {}).lines === undefined
  const legacyTop = legacy ? {
    baseURL: value.baseURL,
    model: value.model,
    displayName: value.displayName,
    contextWindow: value.contextWindow,
    maxTokens: value.maxTokens,
    thinkingBudgets: value.thinkingBudgets,
    defaultThinkingBudget: value.defaultThinkingBudget,
    summarize: value.summarize,
    apiKey: value.apiKey,
  } : undefined
  // The legacy top level belongs to the active line only; the other lines
  // park at their built-in defaults.
  const lines = {
    ninfer: lineRecord('ninfer', value.lines?.ninfer, dialect === 'ninfer' ? legacyTop : undefined),
    llamacpp: lineRecord('llamacpp', value.lines?.llamacpp, dialect === 'llamacpp' ? legacyTop : undefined),
    tabbyapi: lineRecord('tabbyapi', value.lines?.tabbyapi, dialect === 'tabbyapi' ? legacyTop : undefined),
    omlx: lineRecord('omlx', value.lines?.omlx, dialect === 'omlx' ? legacyTop : undefined),
  }
  const active = lines[dialect]
  return {
    dialect,
    lines,
    baseURL: active.baseURL,
    model: active.model,
    displayName: active.displayName,
    contextWindow: active.contextWindow,
    maxTokens: active.maxTokens,
    low: active.low,
    medium: active.medium,
    xhigh: active.xhigh,
    defaultBudget: active.defaultThinkingBudget,
    images: active.images,
    keepTurns: active.keepTurns,
    toolChars: active.toolChars,
    // Per-line credential: the flat field holds the ACTIVE line's key (empty =
    // keyless, the wire omits the Authorization header); every line keeps its
    // own copy under `lines`.
    apiKey: active.apiKey,
  }
}

/** Lift one parked line record onto the flat draft inputs. */
function liftedInputs(record) {
  return {
    baseURL: record.baseURL,
    model: record.model,
    displayName: record.displayName,
    // Per-line credential: each line stores its own key, so switching lines
    // carries each one's key onto the inputs (the flat field mirrors the
    // active line onto save).
    apiKey: record.apiKey,
    contextWindow: record.contextWindow,
    maxTokens: record.maxTokens,
    low: record.low,
    medium: record.medium,
    xhigh: record.xhigh,
    defaultBudget: record.defaultThinkingBudget,
    images: record.images,
    keepTurns: record.keepTurns,
    toolChars: record.toolChars,
  }
}

/** The section entry: locale follows the host observable; data rides the inject face. */
function QwenLocalSectionEntry({ useLocale, load, save }) {
  const locale = useLocale((snapshot) => (snapshot.active === 'zh' ? 'zh' : 'en'))
  const t = COPY[locale]
  const [state, setState] = React.useState({ status: 'loading', error: null, view: null, draft: null, busy: false, saved: false, agentPresets: null })
  // Password-style display for the API key: masked by default, the eye button
  // toggles between revealing and concealing the stored value.
  const [revealedKey, setRevealedKey] = React.useState(false)

  const setDraft = (patch) => setState((s) => ({ ...s, draft: s.draft === null ? s.draft : { ...s.draft, ...patch }, saved: false }))

  // Switching the server line: the flat inputs take the target line's parked
  // record, so each line remembers its own values across switches and back.
  const switchDialect = (next) => {
    setState((s) => {
      if (s.draft === null || s.draft.dialect === next) return s
      const d = s.draft
      return {
        ...s,
        saved: false,
        draft: { ...d, dialect: next, ...liftedInputs(d.lines[next]) },
      }
    })
  }

  React.useEffect(() => {
    let alive = true
    load().then((result) => {
      if (!alive) return
      if (result.ok) setState({ status: 'ready', error: null, view: result.value, draft: toDraft(result.value.value), busy: false, saved: false, agentPresets: result.agentPresets ?? null })
      else setState({ status: 'error', error: result.ok === false && result.error === 'ns-missing' ? t.notFound : result.error, view: null, draft: null, busy: false, saved: false })
    }).catch((error) => {
      if (!alive) return
      setState({ status: 'error', error: t.remoteError + (error instanceof Error ? error.message : String(error)), view: null, draft: null, busy: false, saved: false })
    })
    return () => { alive = false }
    // The page mounts once; reloads happen through explicit actions.
  }, [])

  const doSave = async () => {
    const { view, draft } = state
    const numbers = [
      draft.contextWindow, draft.maxTokens, draft.low, draft.medium, draft.xhigh,
      draft.defaultBudget, draft.keepTurns, draft.toolChars,
      ...Object.values(draft.lines).flatMap((line) => [line.contextWindow, line.maxTokens, line.low, line.medium, line.xhigh, line.defaultThinkingBudget, line.keepTurns, line.toolChars]),
    ]
    if (numbers.some((text) => /^\d+$/.test(String(text)) === false || Number.parseInt(text, 10) <= 0)) {
      setState((s) => ({ ...s, error: t.invalidNumber }))
      return
    }
    setState((s) => ({ ...s, busy: true, error: null }))
    // The top-level fields are what the adapter and the compaction backend
    // read (the active line); `lines` persists every line — connection, window
    // numbers, the thinking budget, AND the trim knobs (the context window is a
    // property of the line's server build, not the model) — so switching
    // dialect and back restores each one's values.
    const lineBlock = (record) => ({
      baseURL: record.baseURL,
      model: record.model,
      displayName: record.displayName,
      // This line's own credential (the flat patch field mirrors the active
      // line; each parked line keeps its own copy here).
      apiKey: record.apiKey,
      contextWindow: Number.parseInt(record.contextWindow, 10),
      maxTokens: Number.parseInt(record.maxTokens, 10),
      thinkingBudgets: {
        low: Number.parseInt(record.low, 10),
        medium: Number.parseInt(record.medium, 10),
        xhigh: Number.parseInt(record.xhigh, 10),
      },
      defaultThinkingBudget: Number.parseInt(record.defaultThinkingBudget, 10),
      summarize: {
        images: record.images,
        keepTurns: Number.parseInt(record.keepTurns, 10),
        toolChars: Number.parseInt(record.toolChars, 10),
      },
    })
    // The active line's persisted record is the parked record with the flat
    // inputs re-applied (the user edits ride the flat fields, not the record).
    const activeRecord = {
      ...draft.lines[draft.dialect],
      baseURL: draft.baseURL,
      model: draft.model,
      displayName: draft.displayName,
      contextWindow: draft.contextWindow,
      maxTokens: draft.maxTokens,
      low: draft.low,
      medium: draft.medium,
      xhigh: draft.xhigh,
      defaultThinkingBudget: draft.defaultBudget,
      images: draft.images,
      keepTurns: draft.keepTurns,
      toolChars: draft.toolChars,
    }
    const persistedLines = { ...draft.lines, [draft.dialect]: activeRecord }
    const patch = {
      dialect: draft.dialect,
      baseURL: draft.baseURL,
      model: draft.model,
      displayName: draft.displayName,
      // The credential rides the section top level, not a line record.
      apiKey: draft.apiKey,
      lines: {
        ninfer: lineBlock(persistedLines.ninfer),
        llamacpp: lineBlock(persistedLines.llamacpp),
        tabbyapi: lineBlock(persistedLines.tabbyapi),
        omlx: lineBlock(persistedLines.omlx),
      },
      contextWindow: Number.parseInt(draft.contextWindow, 10),
      maxTokens: Number.parseInt(draft.maxTokens, 10),
      thinkingBudgets: {
        low: Number.parseInt(draft.low, 10),
        medium: Number.parseInt(draft.medium, 10),
        xhigh: Number.parseInt(draft.xhigh, 10),
      },
      defaultThinkingBudget: Number.parseInt(draft.defaultBudget, 10),
      summarize: {
        images: draft.images,
        keepTurns: Number.parseInt(draft.keepTurns, 10),
        toolChars: Number.parseInt(draft.toolChars, 10),
      },
    }
    const result = await save(view, patch)
    if (result.ok) {
      setState((s) => ({ ...s, busy: false, saved: true, view: result.value, draft: toDraft(result.value.value) }))
    } else if (result.code === 'settings/conflict') {
      const fresh = await load()
      if (fresh.ok) setState({ status: 'ready', error: t.conflict, view: fresh.value, draft: toDraft(fresh.value.value), busy: false, saved: false, agentPresets: fresh.agentPresets ?? null })
      else setState((s) => ({ ...s, busy: false, error: t.remoteError + fresh.error }))
    } else {
      setState((s) => ({ ...s, busy: false, error: t.remoteError + result.error }))
    }
  }

  if (state.status === 'loading') {
    return React.createElement('div', { className: 'qol' }, t.loading)
  }
  if (state.status === 'error') {
    return React.createElement('div', { className: 'qol' }, state.error)
  }
  const { view, draft } = state
  // The status line: the startup snapshot (the section base) with the live
  // agent-presets default from the same describe response — a default change
  // shows up without a restart.
  const compaction = {
    presetGenerated: (view.value.compaction ?? { presetGenerated: false }).presetGenerated,
    defaultPreset: state.agentPresets?.defaultPreset ?? view.value.compaction?.defaultPreset ?? 'standard',
  }
  const ninfer = draft.dialect === 'ninfer'
  return React.createElement('div', { className: 'qol' },
    React.createElement('h2', { className: 'qol-title' }, t.title),
    state.error !== null
      ? React.createElement('p', { className: 'qol-error', role: 'alert' }, state.error)
      : null,
    // Server line: the headline control — it switches the thinking wire for
    // every request the plugin route serves.
    React.createElement('section', { className: 'qol-group' },
      React.createElement('h3', { className: 'qol-groupHead' }, t.line),
      React.createElement('div', { className: 'qol-radioRow' },
        ['llamacpp', 'ninfer', 'tabbyapi', 'omlx'].map((dialect) =>
          React.createElement('label', { key: dialect, className: 'qol-radio' },
            React.createElement('input', {
              type: 'radio',
              name: 'qwen38-dialect',
              checked: draft.dialect === dialect,
              onChange: () => { switchDialect(dialect) },
            }),
            dialect === 'ninfer' ? t.dialectNinfer : dialect === 'tabbyapi' ? t.dialectTabbyapi : dialect === 'omlx' ? t.dialectOmlx : t.dialectLlamacpp,
          ),
        ),
      ),
    ),
    React.createElement('section', { className: 'qol-group' },
      React.createElement('h3', { className: 'qol-groupHead' }, t.connection),
      React.createElement(Field, { label: t.baseURL },
        React.createElement(Input, { className: 'qol-input', value: draft.baseURL, onChange: (e) => { setDraft({ baseURL: e.target.value }) } })),
      React.createElement(Field, { label: t.model },
        React.createElement(Input, { className: 'qol-input', value: draft.model, onChange: (e) => { setDraft({ model: e.target.value }) } })),
      React.createElement(Field, { label: t.displayName },
        React.createElement(Input, { className: 'qol-input', value: draft.displayName, onChange: (e) => { setDraft({ displayName: e.target.value }) } })),
      React.createElement(Field, { label: t.apiKey },
        // The eye toggle overlays the right edge of the key input (close-aligned
        // to the slot) and swaps between the open and closed icons on click.
        React.createElement('div', { style: { position: 'relative' } },
          React.createElement(Input, {
            className: 'qol-input',
            type: revealedKey ? 'text' : 'password',
            value: draft.apiKey,
            onChange: (e) => { setDraft({ apiKey: e.target.value }) },
            style: { paddingRight: 34 },
          }),
          React.createElement('button', {
            type: 'button',
            title: revealedKey ? t.concealKey : t.revealKey,
            onClick: () => { setRevealedKey((v) => !v) },
            style: {
              position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)',
              background: 'none', border: 'none', cursor: 'pointer', color: '#8b93a7', padding: 4,
              display: 'flex', alignItems: 'center',
            },
          }, revealedKey ? EYE_OPEN : EYE_CLOSED))),
      React.createElement('p', { className: 'qol-hint' }, t.apiKeyHint),
    ),
    React.createElement('section', { className: 'qol-group' },
      React.createElement('h3', { className: 'qol-groupHead' }, t.window),
      React.createElement('div', { className: 'qol-row2' },
        React.createElement(Field, { label: t.contextWindow },
          React.createElement(Input, { className: 'qol-input', inputMode: 'numeric', value: draft.contextWindow, onChange: digitsOnly((v) => { setDraft({ contextWindow: v }) }) })),
        React.createElement(Field, { label: t.maxTokens },
          React.createElement(Input, { className: 'qol-input', inputMode: 'numeric', value: draft.maxTokens, onChange: digitsOnly((v) => { setDraft({ maxTokens: v }) }) })),
      ),
    ),
    React.createElement('section', { className: 'qol-group' },
      React.createElement('h3', { className: 'qol-groupHead' }, t.thinking),
      React.createElement('div', { className: ninfer ? 'qol-row3 qol-muted' : 'qol-row3' },
        ['low', 'medium', 'xhigh'].map((effort) =>
          React.createElement(Field, { key: effort, label: effort },
            React.createElement(Input, { className: 'qol-input', inputMode: 'numeric', disabled: ninfer, value: draft[effort], onChange: digitsOnly((v) => { setDraft({ [effort]: v }) }) })),
        ),
      ),
      React.createElement('p', { className: 'qol-hint' }, ninfer ? t.thinkingHintNinfer : draft.dialect === 'tabbyapi' ? t.thinkingHintTabbyapi : draft.dialect === 'omlx' ? t.thinkingHintOmlx : t.thinkingHintLlamacpp),
    ),
    // Compaction: the wiring status first (the trim controls only apply to
    // sessions using the qwen38 preset), then the trim knobs.
    React.createElement('section', { className: 'qol-group' },
      React.createElement('h3', { className: 'qol-groupHead' }, t.compaction),
      React.createElement('div', { className: 'qol-statusRow' },
        React.createElement(StateDot, { state: compactionStatusState(compaction), className: 'qol-statusDot' }),
        compactionStatusCopy(compaction, t),
      ),
      React.createElement('p', { className: 'qol-hint' }, t.compactionHint),
      React.createElement('div', { className: 'qol-field' },
        React.createElement('div', { className: 'qol-switchHead' },
          React.createElement('span', { className: 'qol-switchLabel' }, t.summarizeImages),
          React.createElement(Switch, {
            checked: draft.images === 'keep',
            onChange: (next) => { setDraft({ images: next ? 'keep' : 'strip' }) },
            label: t.summarizeImages,
          }),
        ),
        React.createElement('p', { className: 'qol-hint' }, t.summarizeHint),
      ),
      React.createElement('div', { className: 'qol-row2' },
        React.createElement(Field, { label: t.keepTurns },
          React.createElement(Input, { className: 'qol-input', inputMode: 'numeric', value: draft.keepTurns, onChange: digitsOnly((v) => { setDraft({ keepTurns: v }) }) })),
        React.createElement(Field, { label: t.toolChars },
          React.createElement(Input, { className: 'qol-input', inputMode: 'numeric', value: draft.toolChars, onChange: digitsOnly((v) => { setDraft({ toolChars: v }) }) })),
      ),
    ),
    React.createElement('div', { className: 'qol-footer' },
      React.createElement(Button, { variant: 'primary', disabled: state.busy, onClick: () => { void doSave() } }, state.busy ? t.saving : t.save),
      state.saved ? React.createElement('span', { className: 'qol-saved' }, t.saved) : null,
      state.busy === false && view !== null
        ? React.createElement('span', { className: 'qol-rev' }, `r${view.revision}`)
        : null,
    ),
  )
}

/**
 * Register the settings page.
 * @param ctx - the client root context (slots and the settings Remote).
 */
export function apply(ctx) {
  const locale = () => (ctx.locale.getSnapshot().active === 'zh' ? 'zh' : 'en')
  ctx.slots.inject('settings.section', () => ctx.slots.register(
    {
      name: 'settings.section',
      id: 'qwen38-local-qol',
      order: 90,
      label: () => (locale() === 'en' ? 'Qwen3.8 Local' : 'Qwen3.8 本地'),
      inject: () => ({
        hooks: { locale: ctx.locale },
        load: async () => {
          const response = await ctx.remote.settings.describe()
          if (response.ok !== true) return { ok: false, error: response.error.message }
          const view = response.value.namespaces.find((entry) => entry.ns === NS)
          if (view === undefined) return { ok: false, error: 'ns-missing' }
          const presets = response.value.namespaces.find((entry) => entry.ns === 'agent-presets')
          return {
            ok: true,
            value: view,
            agentPresets: presets === undefined ? null : { revision: presets.revision, defaultPreset: presets.value?.default ?? null },
          }
        },
        save: async (view, patch) => {
          const response = await ctx.remote.settings.update(NS, patch, view.revision)
          if (response.ok !== true) return { ok: false, code: response.error.code, error: response.error.message }
          return { ok: true, value: response.value }
        },
      }),
    },
    QwenLocalSectionEntry,
  ))
}

/** Plugin name, mirroring the host half. */
export const name = 'qwen38-local-qol'

/** Hard client dependencies. `remote` and the dotted `remote.settings` are Cordis client services — the gateway provides each Remote namespace under its dotted name, and the ctx proxy resolves `ctx.remote.settings` against that one; an undeclared service is absent from the plugin's ctx. */
export const inject = ['slots', 'locale', 'remote', 'remote.settings']
