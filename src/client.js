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
 * The source is `React.createElement` (no JSX) and is built by
 * `scripts/build-client.mjs` (esbuild, `react` external) into the DSH
 * client-module format — a self-registering classic script — committed as
 * `lib/client.js`. The styling is inline for the same reason. The dialect selector is
 * the headline control — it switches the thinking wire (NInfer vs
 * llama-server) for every request the plugin route serves.
 *
 * @module dsh-qwen38-local-qol/client
 */
import * as React from 'react'

/** The settings namespace this tab edits (mirrors the host's `NS`). */
const NS = 'qwen38-local-qol'

const COPY = {
  en: {
    title: 'Qwen3.8 Local',
    line: 'Server line',
    dialectNinfer: 'NInfer',
    dialectLlamacpp: 'llama.cpp',
    connection: 'Connection',
    baseURL: 'Server base URL',
    model: 'Model id',
    displayName: 'Display name',
    window: 'Window and output',
    contextWindow: 'Context window (tokens)',
    maxTokens: 'Output cap (tokens)',
    thinking: 'Thinking budgets',
    thinkingAll: 'All efforts',
    thinkingHintNinfer: 'Per-effort thinking budgets are not supported on NInfer (ninfer as of 2026-09-02; ninfer-windows 0.5.0).',
    thinkingHintLlamacpp: 'Hard per-effort thinking-token caps. llama.cpp honors reasoning_budget_tokens per request; the selected level\'s value overrides the server\'s --reasoning-budget flag.',
    compaction: 'Compaction prefill trim',
    summarizeImages: 'Images in the summarizer prefill',
    strip: 'strip to placeholders (prefer with mmproj offload)',
    keep: 'keep',
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
  },
  zh: {
    title: 'Qwen3.8 本地',
    line: '服务器线',
    dialectNinfer: 'NInfer',
    dialectLlamacpp: 'llama.cpp',
    connection: '连接',
    baseURL: '服务器地址',
    model: '模型 id',
    displayName: '显示名',
    window: '窗口与输出',
    contextWindow: '上下文窗口（token）',
    maxTokens: '输出上限（token）',
    thinking: 'Thinking 预算',
    thinkingAll: '全部 effort',
    thinkingHintNinfer: 'NInfer 不支持按 effort 的 thinking 预算（ninfer as of 2026-09-02；ninfer-windows 0.5.0）。',
    thinkingHintLlamacpp: '各 effort 档的 thinking token 硬帽。llama.cpp 逐请求按所选档携带 reasoning_budget_tokens，覆盖服务端 --reasoning-budget 参数。',
    compaction: '压缩预填充裁剪',
    summarizeImages: '摘要预填充里的图片',
    strip: '替换为占位符（mmproj offload 时优选）',
    keep: '保留',
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
  },
}

/** One editable field row: label above a controlled input. */
function Field({ label, hint, children }) {
  return React.createElement('div', { style: { marginBottom: 12 } },
    React.createElement('label', { style: { display: 'block', fontSize: 12, marginBottom: 4, opacity: 0.75 } }, label),
    children,
    hint === undefined ? null
      : React.createElement('div', { style: { fontSize: 11, opacity: 0.6, marginTop: 4, lineHeight: 1.4 } }, hint),
  )
}

const INPUT_STYLE = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '6px 8px',
  fontSize: 13,
  fontFamily: 'inherit',
  border: '1px solid rgba(128, 128, 128, 0.3)',
  borderRadius: 6,
  background: 'transparent',
  color: 'inherit',
}

/**
 * Two-choice dropdown matching the host's Menu primitive look: a themed
 * rounded card (var(--dsw-specific-menu) surface, r12, inverted hairline,
 * lv3 shadow), theme-aware row hover, a trailing check on the selected
 * row. The native <select> popup cannot follow the host theme (it stays
 * white on a dark dialog), so the control is a button + an absolute card
 * instead — the same construction the host's own settings rows use.
 */
function ThemeSelect({ value, options, onChange }) {
  const [open, setOpen] = React.useState(false)
  const [hovered, setHovered] = React.useState(-1)
  const rootRef = React.useRef(null)
  const selected = options.find((option) => option.value === value) ?? options[0]

  React.useEffect(() => {
    if (!open) return
    const onPointerDown = (event) => {
      if (rootRef.current !== null && !rootRef.current.contains(event.target)) setOpen(false)
    }
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  return React.createElement('div', { ref: rootRef, style: { position: 'relative' } },
    React.createElement('button', {
      type: 'button',
      'aria-haspopup': 'listbox',
      'aria-expanded': open,
      onClick: () => setOpen(!open),
      style: { ...INPUT_STYLE, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, cursor: 'pointer', textAlign: 'left' },
    },
      React.createElement('span', { style: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, selected.label),
      React.createElement('svg', {
        width: 14, height: 14, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor',
        strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true,
        style: { flex: 'none', opacity: 0.6 },
      },
        React.createElement('path', { d: 'M6 9l6 6 6-6' }),
      ),
    ),
    open
      ? React.createElement('div', {
        role: 'listbox',
        style: {
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 100,
          padding: 4, boxSizing: 'border-box',
          border: '1px solid var(--dsw-alias-border-inverted, rgba(128, 128, 128, 0.2))',
          borderRadius: 12,
          background: 'var(--dsw-specific-menu, #ffffff)',
          boxShadow: 'var(--dsw-shadow-lv3, 0 8px 24px rgba(0, 0, 0, 0.24))',
        },
      },
        options.map((option, index) =>
          React.createElement('button', {
            key: option.value,
            type: 'button',
            role: 'option',
            'aria-selected': option.value === value,
            onClick: () => { onChange(option.value); setOpen(false); setHovered(-1) },
            onMouseEnter: () => setHovered(index),
            onMouseLeave: () => setHovered(-1),
            style: {
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
              width: '100%', minHeight: 40, padding: '8px 10px', boxSizing: 'border-box',
              border: 'none', borderRadius: 10, cursor: 'pointer',
              fontSize: 13, fontFamily: 'inherit', textAlign: 'left', color: 'inherit',
              background: hovered === index
                ? 'var(--dsw-alias-interactive-bg-hover, rgba(128, 128, 128, 0.12))'
                : 'transparent',
            },
          },
            option.label,
            option.value === value ? React.createElement('span', { style: { flex: 'none', fontSize: 12 } }, '✓') : null,
          ),
        ),
      )
      : null,
  )
}

const BUTTON_STYLE = {
  padding: '6px 18px',
  fontSize: 13,
  border: 'none',
  borderRadius: 6,
  background: 'rgba(128, 128, 128, 0.25)',
  color: 'inherit',
  cursor: 'pointer',
}

// Pin the page text to the host's primary label token instead of bare
// inheritance: var(--dsw-alias-label-primary) flips on the host appearance
// (light: near-black rgb(15,17,21) on the white panel; dark: near-white
// rgb(249,250,251) on the dark panel). The background stays transparent —
// the settings panel already renders the correct themed surface, so the
// page rides it with no seam. The fallback covers a host without the
// tokens. (label-primary-foreground is the inverted label *surface*, not
// the text color — do not use it here.)
const ROOT_STYLE = {
  maxWidth: 560,
  color: 'var(--dsw-alias-label-primary, #111111)',
}

/**
 * Pull the editable draft out of a namespace view's resolved value.
 *
 * The connection fields are per-dialect (`lines`): the draft carries the
 * active line (baseURL/model/displayName) plus the parked other line, and the
 * dialect control swaps the two. Sections saved before `lines` existed carry
 * the connection only at the top level — detect that from the user layer and
 * migrate the top level into the active line instead of showing the schema
 * defaults on top of the user's saved values.
 *
 * The numeric fields fall back to the production line's values so a fresh
 * install (no user layer) is fill-once: only the connection fields may be
 * empty of meaning, everything else ships pre-filled.
 */
export function toDraft(value) {
  const dialect = value.dialect
  const other = dialect === 'ninfer' ? 'llamacpp' : 'ninfer'
  const legacy = (value.user ?? {}).lines === undefined
  const line = (name) => {
    const raw = value.lines?.[name]
    return {
      baseURL: raw?.baseURL ?? '',
      model: raw?.model ?? '',
      displayName: raw?.displayName ?? '',
      contextWindow: String(raw?.contextWindow ?? value.contextWindow ?? 229376),
      maxTokens: String(raw?.maxTokens ?? value.maxTokens ?? 24576),
      low: String(raw?.thinkingBudgets?.low ?? value.thinkingBudgets?.low ?? 4096),
      medium: String(raw?.thinkingBudgets?.medium ?? value.thinkingBudgets?.medium ?? 8192),
      xhigh: String(raw?.thinkingBudgets?.xhigh ?? value.thinkingBudgets?.xhigh ?? 16384),
    }
  }
  const active = legacy
    ? {
      baseURL: value.baseURL ?? '',
      model: value.model ?? '',
      displayName: value.displayName ?? '',
      contextWindow: String(value.contextWindow ?? 229376),
      maxTokens: String(value.maxTokens ?? 24576),
      low: String(value.thinkingBudgets?.low ?? 4096),
      medium: String(value.thinkingBudgets?.medium ?? 8192),
      xhigh: String(value.thinkingBudgets?.xhigh ?? 16384),
    }
    : line(dialect)
  const parked = line(other)
  return {
    dialect,
    baseURL: active.baseURL,
    model: active.model,
    displayName: active.displayName,
    contextWindow: active.contextWindow,
    maxTokens: active.maxTokens,
    low: active.low,
    medium: active.medium,
    xhigh: active.xhigh,
    parkedBaseURL: parked.baseURL,
    parkedModel: parked.model,
    parkedDisplayName: parked.displayName,
    parkedContextWindow: parked.contextWindow,
    parkedMaxTokens: parked.maxTokens,
    parkedLow: parked.low,
    parkedMedium: parked.medium,
    parkedXhigh: parked.xhigh,
    defaultBudget: String(value.defaultThinkingBudget ?? 16384),
    images: value.summarize?.images ?? 'strip',
    keepTurns: String(value.summarize?.keepTurns ?? 5),
    toolChars: String(value.summarize?.toolChars ?? 2000),
  }
}

/** The section entry: locale follows the host observable; data rides the inject face. */
function QwenLocalSectionEntry({ useLocale, load, save }) {
  const locale = useLocale((snapshot) => (snapshot.active === 'zh' ? 'zh' : 'en'))
  const t = COPY[locale]
  const [state, setState] = React.useState({ status: 'loading', error: null, view: null, draft: null, busy: false, saved: false })

  const setDraft = (patch) => setState((s) => ({ ...s, draft: s.draft === null ? s.draft : { ...s.draft, ...patch }, saved: false }))

  // Switching the server line: the active connection fields and the parked
  // (other dialect's) fields trade places, so each line remembers its own
  // baseURL/model/displayName across switches and back.
  const switchDialect = (next) => {
    setState((s) => {
      if (s.draft === null || s.draft.dialect === next) return s
      const d = s.draft
      return {
        ...s,
        saved: false,
        draft: {
          ...d,
          dialect: next,
          baseURL: d.parkedBaseURL,
          model: d.parkedModel,
          displayName: d.parkedDisplayName,
          contextWindow: d.parkedContextWindow,
          maxTokens: d.parkedMaxTokens,
          low: d.parkedLow,
          medium: d.parkedMedium,
          xhigh: d.parkedXhigh,
          parkedBaseURL: d.baseURL,
          parkedModel: d.model,
          parkedDisplayName: d.displayName,
          parkedContextWindow: d.contextWindow,
          parkedMaxTokens: d.maxTokens,
          parkedLow: d.low,
          parkedMedium: d.medium,
          parkedXhigh: d.xhigh,
        },
      }
    })
  }

  React.useEffect(() => {
    let alive = true
    load().then((result) => {
      if (!alive) return
      if (result.ok) setState({ status: 'ready', error: null, view: result.value, draft: toDraft(result.value.value), busy: false, saved: false })
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
      draft.parkedContextWindow, draft.parkedMaxTokens, draft.parkedLow, draft.parkedMedium, draft.parkedXhigh,
      draft.defaultBudget, draft.keepTurns, draft.toolChars,
    ]
    if (numbers.some((text) => /^\d+$/.test(String(text)) === false || Number.parseInt(text, 10) <= 0)) {
      setState((s) => ({ ...s, error: t.invalidNumber }))
      return
    }
    setState((s) => ({ ...s, busy: true, error: null }))
    // The top-level fields are what the adapter reads (the active line);
    // `lines` persists both lines — connection AND window numbers (the
    // context window is a property of the line's server build, not the
    // model) — so switching dialect and back restores each one's values.
    const otherDialect = draft.dialect === 'ninfer' ? 'llamacpp' : 'ninfer'
    const lineBlock = (baseURL, model, displayName, contextWindow, maxTokens, low, medium, xhigh) => ({
      baseURL,
      model,
      displayName,
      contextWindow: Number.parseInt(contextWindow, 10),
      maxTokens: Number.parseInt(maxTokens, 10),
      thinkingBudgets: {
        low: Number.parseInt(low, 10),
        medium: Number.parseInt(medium, 10),
        xhigh: Number.parseInt(xhigh, 10),
      },
    })
    const patch = {
      dialect: draft.dialect,
      baseURL: draft.baseURL,
      model: draft.model,
      displayName: draft.displayName,
      lines: {
        [draft.dialect]: lineBlock(draft.baseURL, draft.model, draft.displayName, draft.contextWindow, draft.maxTokens, draft.low, draft.medium, draft.xhigh),
        [otherDialect]: lineBlock(draft.parkedBaseURL, draft.parkedModel, draft.parkedDisplayName, draft.parkedContextWindow, draft.parkedMaxTokens, draft.parkedLow, draft.parkedMedium, draft.parkedXhigh),
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
      if (fresh.ok) setState({ status: 'ready', error: t.conflict, view: fresh.value, draft: toDraft(fresh.value.value), busy: false, saved: false })
      else setState((s) => ({ ...s, busy: false, error: t.remoteError + fresh.error }))
    } else {
      setState((s) => ({ ...s, busy: false, error: t.remoteError + result.error }))
    }
  }

  if (state.status === 'loading') {
    return React.createElement('div', { style: ROOT_STYLE }, t.loading)
  }
  if (state.status === 'error') {
    return React.createElement('div', { style: ROOT_STYLE }, state.error)
  }
  const { view, draft } = state
  return React.createElement('div', { style: ROOT_STYLE },
    React.createElement('h2', { style: { marginTop: 0 } }, t.title),
    state.error !== null
      ? React.createElement('div', { style: { fontSize: 12, opacity: 0.8, marginBottom: 12 } }, state.error)
      : null,
    React.createElement('div', null,
      React.createElement('div', { style: { fontSize: 12, marginBottom: 4, opacity: 0.75 } }, t.line),
      React.createElement('div', { style: { display: 'flex', gap: 16, marginBottom: 16 } },
        ['llamacpp', 'ninfer'].map((dialect) =>
          React.createElement('label', { key: dialect, style: { display: 'flex', gap: 6, alignItems: 'center', fontSize: 13, cursor: 'pointer' } },
            React.createElement('input', {
              type: 'radio',
              name: 'qwen38-dialect',
              checked: draft.dialect === dialect,
              onChange: () => switchDialect(dialect),
            }),
            dialect === 'ninfer' ? t.dialectNinfer : t.dialectLlamacpp,
          ),
        ),
      ),
    ),
    React.createElement('div', null,
      React.createElement('div', { style: { fontSize: 12, marginBottom: 4, opacity: 0.75 } }, t.connection),
      React.createElement(Field, { label: t.baseURL },
        React.createElement('input', { style: INPUT_STYLE, value: draft.baseURL, onChange: (e) => setDraft({ baseURL: e.target.value }) })),
      React.createElement(Field, { label: t.model },
        React.createElement('input', { style: INPUT_STYLE, value: draft.model, onChange: (e) => setDraft({ model: e.target.value }) })),
      React.createElement(Field, { label: t.displayName },
        React.createElement('input', { style: INPUT_STYLE, value: draft.displayName, onChange: (e) => setDraft({ displayName: e.target.value }) })),
    ),
    React.createElement('div', null,
      React.createElement('div', { style: { fontSize: 12, marginBottom: 4, opacity: 0.75 } }, t.window),
      React.createElement(Field, { label: t.contextWindow },
        React.createElement('input', { style: INPUT_STYLE, value: draft.contextWindow, onChange: (e) => setDraft({ contextWindow: e.target.value }) })),
      React.createElement(Field, { label: t.maxTokens },
        React.createElement('input', { style: INPUT_STYLE, value: draft.maxTokens, onChange: (e) => setDraft({ maxTokens: e.target.value }) })),
    ),
    React.createElement('div', null,
      React.createElement('div', { style: { fontSize: 12, marginBottom: 4, opacity: 0.75 } }, t.thinking),
      draft.dialect === 'ninfer'
        ? React.createElement(Field, { label: t.thinkingAll },
          React.createElement('input', { style: INPUT_STYLE, value: draft.defaultBudget, onChange: (e) => setDraft({ defaultBudget: e.target.value }) }))
        : null,
      React.createElement('div', { style: { display: 'flex', gap: 8, marginBottom: 8, opacity: draft.dialect === 'ninfer' ? 0.45 : 1 } },
        ['low', 'medium', 'xhigh'].map((effort) =>
          React.createElement('div', { key: effort, style: { flex: 1 } },
            React.createElement('label', { style: { display: 'block', fontSize: 11, marginBottom: 2, opacity: 0.7 } }, effort),
            React.createElement('input', { style: INPUT_STYLE, disabled: draft.dialect === 'ninfer', value: draft[effort], onChange: (e) => setDraft({ [effort]: e.target.value }) }),
          ),
        ),
      ),
      React.createElement('div', { style: { fontSize: 11, opacity: 0.6, marginTop: 4, marginBottom: 12, lineHeight: 1.4 } }, draft.dialect === 'ninfer' ? t.thinkingHintNinfer : t.thinkingHintLlamacpp),
    ),
    React.createElement('div', null,
      React.createElement('div', { style: { fontSize: 12, marginBottom: 4, opacity: 0.75 } }, t.compaction),
      React.createElement(Field, { label: t.summarizeImages },
        React.createElement(ThemeSelect, {
          value: draft.images,
          options: [{ value: 'strip', label: t.strip }, { value: 'keep', label: t.keep }],
          onChange: (images) => setDraft({ images }),
        })),
      React.createElement('div', { style: { display: 'flex', gap: 8 } },
        React.createElement('div', { style: { flex: 1 } },
          React.createElement(Field, { label: t.keepTurns },
            React.createElement('input', { style: INPUT_STYLE, value: draft.keepTurns, onChange: (e) => setDraft({ keepTurns: e.target.value }) }))),
        React.createElement('div', { style: { flex: 1 } },
          React.createElement(Field, { label: t.toolChars },
            React.createElement('input', { style: INPUT_STYLE, value: draft.toolChars, onChange: (e) => setDraft({ toolChars: e.target.value }) }))),
      ),
    ),
    React.createElement('div', { style: { display: 'flex', gap: 12, alignItems: 'center', marginTop: 8 } },
      React.createElement('button', { style: BUTTON_STYLE, disabled: state.busy, onClick: doSave }, state.busy ? t.saving : t.save),
      state.saved ? React.createElement('span', { style: { fontSize: 12, opacity: 0.7 } }, t.saved) : null,
      state.busy === false && view !== null
        ? React.createElement('span', { style: { fontSize: 11, opacity: 0.5 } }, `r${view.revision}`)
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
          return { ok: true, value: view }
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
