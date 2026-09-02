window.__ModuleLoader__.load({
  id: "dsh-qwen38-local-qol",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name2 in all)
    __defProp(target, name2, { get: all[name2], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/client.js
var client_exports = {};
__export(client_exports, {
  apply: () => apply,
  inject: () => inject,
  name: () => name,
  toDraft: () => toDraft
});
module.exports = __toCommonJS(client_exports);
var React = __toESM(require("react"), 1);
var NS = "qwen38-local-qol";
var COPY = {
  en: {
    title: "Qwen3.8 Local",
    line: "Server line",
    dialectNinfer: "NInfer",
    dialectLlamacpp: "llama.cpp",
    connection: "Connection",
    baseURL: "Server base URL",
    model: "Model id",
    displayName: "Display name",
    window: "Window and output",
    contextWindow: "Context window (tokens)",
    maxTokens: "Output cap (tokens)",
    thinking: "Thinking budgets",
    thinkingHintNinfer: "Not supported by NInfer (upstream Docker or the Windows build): reasoning_budget_tokens is sent but ignored. Effective cap = the server's --default-thinking-budget flag; these values only define the client-side effort vocabulary.",
    thinkingHintLlamacpp: "Hard per-effort thinking-token caps. llama.cpp honors reasoning_budget_tokens per request; the selected level's value overrides the server's --reasoning-budget flag.",
    compaction: "Compaction prefill trim",
    summarizeImages: "Images in the summarizer prefill",
    strip: "strip to placeholders (prefer with mmproj offload)",
    keep: "keep",
    keepTurns: "Keep reasoning of the last N turns",
    toolChars: "Tool-result character cap (0 = off)",
    save: "Save",
    saving: "Saving\u2026",
    saved: "Saved",
    loading: "Loading\u2026",
    notFound: "This plugin is not registered a settings section on the host side (restart DSH web after installing the plugin, then open this page again).",
    conflict: "Someone else changed these settings while you were editing. Your edits were discarded; the current values are shown.",
    invalidNumber: "Every number field must be a positive whole number.",
    remoteError: "Settings request failed: "
  },
  zh: {
    title: "Qwen3.8 \u672C\u5730",
    line: "\u670D\u52A1\u5668\u7EBF",
    dialectNinfer: "NInfer",
    dialectLlamacpp: "llama.cpp",
    connection: "\u8FDE\u63A5",
    baseURL: "\u670D\u52A1\u5668\u5730\u5740",
    model: "\u6A21\u578B id",
    displayName: "\u663E\u793A\u540D",
    window: "\u7A97\u53E3\u4E0E\u8F93\u51FA",
    contextWindow: "\u4E0A\u4E0B\u6587\u7A97\u53E3\uFF08token\uFF09",
    maxTokens: "\u8F93\u51FA\u4E0A\u9650\uFF08token\uFF09",
    thinking: "Thinking \u9884\u7B97",
    thinkingHintNinfer: "NInfer\uFF08\u539F\u7248 Docker \u6216 Windows build\uFF09\u4E0D\u652F\u6301\u9010\u8BF7\u6C42 thinking \u9884\u7B97\uFF1Areasoning_budget_tokens \u7167\u53D1\u4F46\u88AB\u5FFD\u7565\u3002\u5B9E\u9645\u5E3D = \u670D\u52A1\u7AEF --default-thinking-budget \u53C2\u6570\uFF1B\u8FD9\u4E9B\u503C\u53EA\u5B9A\u4E49\u5BA2\u6237\u7AEF effort \u8BCD\u6C47\u3002",
    thinkingHintLlamacpp: "\u5404 effort \u6863\u7684 thinking token \u786C\u5E3D\u3002llama.cpp \u9010\u8BF7\u6C42\u6309\u6240\u9009\u6863\u643A\u5E26 reasoning_budget_tokens\uFF0C\u8986\u76D6\u670D\u52A1\u7AEF --reasoning-budget \u53C2\u6570\u3002",
    compaction: "\u538B\u7F29\u9884\u586B\u5145\u88C1\u526A",
    summarizeImages: "\u6458\u8981\u9884\u586B\u5145\u91CC\u7684\u56FE\u7247",
    strip: "\u66FF\u6362\u4E3A\u5360\u4F4D\u7B26\uFF08mmproj offload \u65F6\u4F18\u9009\uFF09",
    keep: "\u4FDD\u7559",
    keepTurns: "\u4FDD\u7559\u6700\u8FD1 N \u8F6E\u7684 reasoning",
    toolChars: "\u5DE5\u5177\u7ED3\u679C\u5B57\u6570\u5E3D\uFF080 = \u5173\uFF09",
    save: "\u4FDD\u5B58",
    saving: "\u4FDD\u5B58\u4E2D\u2026",
    saved: "\u5DF2\u4FDD\u5B58",
    loading: "\u52A0\u8F7D\u4E2D\u2026",
    notFound: "\u5BBF\u4E3B\u4FA7\u672A\u6CE8\u518C\u8BE5\u63D2\u4EF6\u7684\u8BBE\u7F6E\u547D\u540D\u7A7A\u95F4\uFF08\u88C5\u5B8C\u63D2\u4EF6\u540E\u91CD\u542F DSH web\uFF0C\u518D\u6253\u5F00\u672C\u9875\u9762\uFF09\u3002",
    conflict: "\u7F16\u8F91\u671F\u95F4\u4ED6\u4EBA\u4FEE\u6539\u4E86\u8FD9\u4E9B\u8BBE\u7F6E\u3002\u4F60\u7684\u6539\u52A8\u5DF2\u4E22\u5F03\uFF0C\u5F53\u524D\u663E\u793A\u7684\u662F\u6700\u65B0\u503C\u3002",
    invalidNumber: "\u6240\u6709\u6570\u5B57\u5B57\u6BB5\u5FC5\u987B\u662F\u6B63\u6574\u6570\u3002",
    remoteError: "\u8BBE\u7F6E\u8BF7\u6C42\u5931\u8D25\uFF1A"
  }
};
function Field({ label, hint, children }) {
  return React.createElement(
    "div",
    { style: { marginBottom: 12 } },
    React.createElement("label", { style: { display: "block", fontSize: 12, marginBottom: 4, opacity: 0.75 } }, label),
    children,
    hint === void 0 ? null : React.createElement("div", { style: { fontSize: 11, opacity: 0.6, marginTop: 4, lineHeight: 1.4 } }, hint)
  );
}
var INPUT_STYLE = {
  width: "100%",
  boxSizing: "border-box",
  padding: "6px 8px",
  fontSize: 13,
  fontFamily: "inherit",
  border: "1px solid rgba(128, 128, 128, 0.3)",
  borderRadius: 6,
  background: "transparent",
  color: "inherit"
};
function ThemeSelect({ value, options, onChange }) {
  const [open, setOpen] = React.useState(false);
  const [hovered, setHovered] = React.useState(-1);
  const rootRef = React.useRef(null);
  const selected = options.find((option) => option.value === value) ?? options[0];
  React.useEffect(() => {
    if (!open) return;
    const onPointerDown = (event) => {
      if (rootRef.current !== null && !rootRef.current.contains(event.target)) setOpen(false);
    };
    const onKeyDown = (event) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);
  return React.createElement(
    "div",
    { ref: rootRef, style: { position: "relative" } },
    React.createElement(
      "button",
      {
        type: "button",
        "aria-haspopup": "listbox",
        "aria-expanded": open,
        onClick: () => setOpen(!open),
        style: { ...INPUT_STYLE, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, cursor: "pointer", textAlign: "left" }
      },
      React.createElement("span", { style: { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, selected.label),
      React.createElement(
        "svg",
        {
          width: 14,
          height: 14,
          viewBox: "0 0 24 24",
          fill: "none",
          stroke: "currentColor",
          strokeWidth: 2,
          strokeLinecap: "round",
          strokeLinejoin: "round",
          "aria-hidden": true,
          style: { flex: "none", opacity: 0.6 }
        },
        React.createElement("path", { d: "M6 9l6 6 6-6" })
      )
    ),
    open ? React.createElement(
      "div",
      {
        role: "listbox",
        style: {
          position: "absolute",
          top: "calc(100% + 4px)",
          left: 0,
          right: 0,
          zIndex: 100,
          padding: 4,
          boxSizing: "border-box",
          border: "1px solid var(--dsw-alias-border-inverted, rgba(128, 128, 128, 0.2))",
          borderRadius: 12,
          background: "var(--dsw-specific-menu, #ffffff)",
          boxShadow: "var(--dsw-shadow-lv3, 0 8px 24px rgba(0, 0, 0, 0.24))"
        }
      },
      options.map(
        (option, index) => React.createElement(
          "button",
          {
            key: option.value,
            type: "button",
            role: "option",
            "aria-selected": option.value === value,
            onClick: () => {
              onChange(option.value);
              setOpen(false);
              setHovered(-1);
            },
            onMouseEnter: () => setHovered(index),
            onMouseLeave: () => setHovered(-1),
            style: {
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 8,
              width: "100%",
              minHeight: 40,
              padding: "8px 10px",
              boxSizing: "border-box",
              border: "none",
              borderRadius: 10,
              cursor: "pointer",
              fontSize: 13,
              fontFamily: "inherit",
              textAlign: "left",
              color: "inherit",
              background: hovered === index ? "var(--dsw-alias-interactive-bg-hover, rgba(128, 128, 128, 0.12))" : "transparent"
            }
          },
          option.label,
          option.value === value ? React.createElement("span", { style: { flex: "none", fontSize: 12 } }, "\u2713") : null
        )
      )
    ) : null
  );
}
var BUTTON_STYLE = {
  padding: "6px 18px",
  fontSize: 13,
  border: "none",
  borderRadius: 6,
  background: "rgba(128, 128, 128, 0.25)",
  color: "inherit",
  cursor: "pointer"
};
var ROOT_STYLE = {
  maxWidth: 560,
  color: "var(--dsw-alias-label-primary, #111111)"
};
function toDraft(value) {
  const dialect = value.dialect;
  const other = dialect === "ninfer" ? "llamacpp" : "ninfer";
  const legacy = (value.user ?? {}).lines === void 0;
  const line = (name2) => {
    const raw = value.lines?.[name2];
    return {
      baseURL: raw?.baseURL ?? "",
      model: raw?.model ?? "",
      displayName: raw?.displayName ?? "",
      contextWindow: String(raw?.contextWindow ?? value.contextWindow ?? 229376),
      maxTokens: String(raw?.maxTokens ?? value.maxTokens ?? 24576),
      low: String(raw?.thinkingBudgets?.low ?? value.thinkingBudgets?.low ?? 4096),
      medium: String(raw?.thinkingBudgets?.medium ?? value.thinkingBudgets?.medium ?? 8192),
      xhigh: String(raw?.thinkingBudgets?.xhigh ?? value.thinkingBudgets?.xhigh ?? 16384)
    };
  };
  const active = legacy ? {
    baseURL: value.baseURL ?? "",
    model: value.model ?? "",
    displayName: value.displayName ?? "",
    contextWindow: String(value.contextWindow ?? 229376),
    maxTokens: String(value.maxTokens ?? 24576),
    low: String(value.thinkingBudgets?.low ?? 4096),
    medium: String(value.thinkingBudgets?.medium ?? 8192),
    xhigh: String(value.thinkingBudgets?.xhigh ?? 16384)
  } : line(dialect);
  const parked = line(other);
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
    images: value.summarize?.images ?? "strip",
    keepTurns: String(value.summarize?.keepTurns ?? 5),
    toolChars: String(value.summarize?.toolChars ?? 2e3)
  };
}
function QwenLocalSectionEntry({ useLocale, load, save }) {
  const locale = useLocale((snapshot) => snapshot.active === "zh" ? "zh" : "en");
  const t = COPY[locale];
  const [state, setState] = React.useState({ status: "loading", error: null, view: null, draft: null, busy: false, saved: false });
  const setDraft = (patch) => setState((s) => ({ ...s, draft: s.draft === null ? s.draft : { ...s.draft, ...patch }, saved: false }));
  const switchDialect = (next) => {
    setState((s) => {
      if (s.draft === null || s.draft.dialect === next) return s;
      const d = s.draft;
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
          parkedXhigh: d.xhigh
        }
      };
    });
  };
  React.useEffect(() => {
    let alive = true;
    load().then((result) => {
      if (!alive) return;
      if (result.ok) setState({ status: "ready", error: null, view: result.value, draft: toDraft(result.value.value), busy: false, saved: false });
      else setState({ status: "error", error: result.ok === false && result.error === "ns-missing" ? t.notFound : result.error, view: null, draft: null, busy: false, saved: false });
    }).catch((error) => {
      if (!alive) return;
      setState({ status: "error", error: t.remoteError + (error instanceof Error ? error.message : String(error)), view: null, draft: null, busy: false, saved: false });
    });
    return () => {
      alive = false;
    };
  }, []);
  const doSave = async () => {
    const { view: view2, draft: draft2 } = state;
    const numbers = [
      draft2.contextWindow,
      draft2.maxTokens,
      draft2.low,
      draft2.medium,
      draft2.xhigh,
      draft2.parkedContextWindow,
      draft2.parkedMaxTokens,
      draft2.parkedLow,
      draft2.parkedMedium,
      draft2.parkedXhigh,
      draft2.keepTurns,
      draft2.toolChars
    ];
    if (numbers.some((text) => /^\d+$/.test(String(text)) === false || Number.parseInt(text, 10) <= 0)) {
      setState((s) => ({ ...s, error: t.invalidNumber }));
      return;
    }
    setState((s) => ({ ...s, busy: true, error: null }));
    const otherDialect = draft2.dialect === "ninfer" ? "llamacpp" : "ninfer";
    const lineBlock = (baseURL, model, displayName, contextWindow, maxTokens, low, medium, xhigh) => ({
      baseURL,
      model,
      displayName,
      contextWindow: Number.parseInt(contextWindow, 10),
      maxTokens: Number.parseInt(maxTokens, 10),
      thinkingBudgets: {
        low: Number.parseInt(low, 10),
        medium: Number.parseInt(medium, 10),
        xhigh: Number.parseInt(xhigh, 10)
      }
    });
    const patch = {
      dialect: draft2.dialect,
      baseURL: draft2.baseURL,
      model: draft2.model,
      displayName: draft2.displayName,
      lines: {
        [draft2.dialect]: lineBlock(draft2.baseURL, draft2.model, draft2.displayName, draft2.contextWindow, draft2.maxTokens, draft2.low, draft2.medium, draft2.xhigh),
        [otherDialect]: lineBlock(draft2.parkedBaseURL, draft2.parkedModel, draft2.parkedDisplayName, draft2.parkedContextWindow, draft2.parkedMaxTokens, draft2.parkedLow, draft2.parkedMedium, draft2.parkedXhigh)
      },
      contextWindow: Number.parseInt(draft2.contextWindow, 10),
      maxTokens: Number.parseInt(draft2.maxTokens, 10),
      thinkingBudgets: {
        low: Number.parseInt(draft2.low, 10),
        medium: Number.parseInt(draft2.medium, 10),
        xhigh: Number.parseInt(draft2.xhigh, 10)
      },
      summarize: {
        images: draft2.images,
        keepTurns: Number.parseInt(draft2.keepTurns, 10),
        toolChars: Number.parseInt(draft2.toolChars, 10)
      }
    };
    const result = await save(view2, patch);
    if (result.ok) {
      setState((s) => ({ ...s, busy: false, saved: true, view: result.value, draft: toDraft(result.value.value) }));
    } else if (result.code === "settings/conflict") {
      const fresh = await load();
      if (fresh.ok) setState({ status: "ready", error: t.conflict, view: fresh.value, draft: toDraft(fresh.value.value), busy: false, saved: false });
      else setState((s) => ({ ...s, busy: false, error: t.remoteError + fresh.error }));
    } else {
      setState((s) => ({ ...s, busy: false, error: t.remoteError + result.error }));
    }
  };
  if (state.status === "loading") {
    return React.createElement("div", { style: ROOT_STYLE }, t.loading);
  }
  if (state.status === "error") {
    return React.createElement("div", { style: ROOT_STYLE }, state.error);
  }
  const { view, draft } = state;
  return React.createElement(
    "div",
    { style: ROOT_STYLE },
    React.createElement("h2", { style: { marginTop: 0 } }, t.title),
    state.error !== null ? React.createElement("div", { style: { fontSize: 12, opacity: 0.8, marginBottom: 12 } }, state.error) : null,
    React.createElement(
      "div",
      null,
      React.createElement("div", { style: { fontSize: 12, marginBottom: 4, opacity: 0.75 } }, t.line),
      React.createElement(
        "div",
        { style: { display: "flex", gap: 16, marginBottom: 16 } },
        ["llamacpp", "ninfer"].map(
          (dialect) => React.createElement(
            "label",
            { key: dialect, style: { display: "flex", gap: 6, alignItems: "center", fontSize: 13, cursor: "pointer" } },
            React.createElement("input", {
              type: "radio",
              name: "qwen38-dialect",
              checked: draft.dialect === dialect,
              onChange: () => switchDialect(dialect)
            }),
            dialect === "ninfer" ? t.dialectNinfer : t.dialectLlamacpp
          )
        )
      )
    ),
    React.createElement(
      "div",
      null,
      React.createElement("div", { style: { fontSize: 12, marginBottom: 4, opacity: 0.75 } }, t.connection),
      React.createElement(
        Field,
        { label: t.baseURL },
        React.createElement("input", { style: INPUT_STYLE, value: draft.baseURL, onChange: (e) => setDraft({ baseURL: e.target.value }) })
      ),
      React.createElement(
        Field,
        { label: t.model },
        React.createElement("input", { style: INPUT_STYLE, value: draft.model, onChange: (e) => setDraft({ model: e.target.value }) })
      ),
      React.createElement(
        Field,
        { label: t.displayName },
        React.createElement("input", { style: INPUT_STYLE, value: draft.displayName, onChange: (e) => setDraft({ displayName: e.target.value }) })
      )
    ),
    React.createElement(
      "div",
      null,
      React.createElement("div", { style: { fontSize: 12, marginBottom: 4, opacity: 0.75 } }, t.window),
      React.createElement(
        Field,
        { label: t.contextWindow },
        React.createElement("input", { style: INPUT_STYLE, value: draft.contextWindow, onChange: (e) => setDraft({ contextWindow: e.target.value }) })
      ),
      React.createElement(
        Field,
        { label: t.maxTokens },
        React.createElement("input", { style: INPUT_STYLE, value: draft.maxTokens, onChange: (e) => setDraft({ maxTokens: e.target.value }) })
      )
    ),
    React.createElement(
      "div",
      null,
      React.createElement("div", { style: { fontSize: 12, marginBottom: 4, opacity: 0.75 } }, t.thinking),
      React.createElement(
        "div",
        { style: { display: "flex", gap: 8, marginBottom: 8 } },
        ["low", "medium", "xhigh"].map(
          (effort) => React.createElement(
            "div",
            { key: effort, style: { flex: 1 } },
            React.createElement("label", { style: { display: "block", fontSize: 11, marginBottom: 2, opacity: 0.7 } }, effort),
            React.createElement("input", { style: INPUT_STYLE, value: draft[effort], onChange: (e) => setDraft({ [effort]: e.target.value }) })
          )
        )
      ),
      React.createElement("div", { style: { fontSize: 11, opacity: 0.6, marginTop: 4, lineHeight: 1.4 } }, draft.dialect === "ninfer" ? t.thinkingHintNinfer : t.thinkingHintLlamacpp)
    ),
    React.createElement(
      "div",
      null,
      React.createElement("div", { style: { fontSize: 12, marginBottom: 4, opacity: 0.75 } }, t.compaction),
      React.createElement(
        Field,
        { label: t.summarizeImages },
        React.createElement(ThemeSelect, {
          value: draft.images,
          options: [{ value: "strip", label: t.strip }, { value: "keep", label: t.keep }],
          onChange: (images) => setDraft({ images })
        })
      ),
      React.createElement(
        "div",
        { style: { display: "flex", gap: 8 } },
        React.createElement(
          "div",
          { style: { flex: 1 } },
          React.createElement(
            Field,
            { label: t.keepTurns },
            React.createElement("input", { style: INPUT_STYLE, value: draft.keepTurns, onChange: (e) => setDraft({ keepTurns: e.target.value }) })
          )
        ),
        React.createElement(
          "div",
          { style: { flex: 1 } },
          React.createElement(
            Field,
            { label: t.toolChars },
            React.createElement("input", { style: INPUT_STYLE, value: draft.toolChars, onChange: (e) => setDraft({ toolChars: e.target.value }) })
          )
        )
      )
    ),
    React.createElement(
      "div",
      { style: { display: "flex", gap: 12, alignItems: "center", marginTop: 8 } },
      React.createElement("button", { style: BUTTON_STYLE, disabled: state.busy, onClick: doSave }, state.busy ? t.saving : t.save),
      state.saved ? React.createElement("span", { style: { fontSize: 12, opacity: 0.7 } }, t.saved) : null,
      state.busy === false && view !== null ? React.createElement("span", { style: { fontSize: 11, opacity: 0.5 } }, `r${view.revision}`) : null
    )
  );
}
function apply(ctx) {
  const locale = () => ctx.locale.getSnapshot().active === "zh" ? "zh" : "en";
  ctx.slots.inject("settings.section", () => ctx.slots.register(
    {
      name: "settings.section",
      id: "qwen38-local-qol",
      order: 90,
      label: () => locale() === "en" ? "Qwen3.8 Local" : "Qwen3.8 \u672C\u5730",
      inject: () => ({
        hooks: { locale: ctx.locale },
        load: async () => {
          const response = await ctx.remote.settings.describe();
          if (response.ok !== true) return { ok: false, error: response.error.message };
          const view = response.value.namespaces.find((entry) => entry.ns === NS);
          if (view === void 0) return { ok: false, error: "ns-missing" };
          return { ok: true, value: view };
        },
        save: async (view, patch) => {
          const response = await ctx.remote.settings.update(NS, patch, view.revision);
          if (response.ok !== true) return { ok: false, code: response.error.code, error: response.error.message };
          return { ok: true, value: response.value };
        }
      })
    },
    QwenLocalSectionEntry
  ));
}
var name = "qwen38-local-qol";
var inject = ["slots", "locale", "remote", "remote.settings"];

    return module.exports;
  },
});
