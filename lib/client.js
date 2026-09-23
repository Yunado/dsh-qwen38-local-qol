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

// src/client-entry.js
var client_entry_exports = {};
__export(client_entry_exports, {
  apply: () => apply,
  compactionStatusCopy: () => compactionStatusCopy,
  compactionStatusState: () => compactionStatusState,
  inject: () => inject,
  name: () => name,
  toDraft: () => toDraft
});
module.exports = __toCommonJS(client_entry_exports);

// src/client.css
var client_default = "/*\n * Qwen3.8 Local settings tab \u2014 the official look.\n *\n * Same recipe as the host's own settings sections: the shared\n * ui-primitives controls (Button/Input/Switch/StateDot, imported in\n * client.js) plus the --dsw-alias-* design tokens; no literal colors, no\n * theme branches. Layout mirrors the harness sections: 720px column, 18px\n * title, 12px uppercase tertiary group heads, 0.5px hairline fields.\n *\n * Classes are `qol-` prefixed (not CSS Modules) so the sheet can ship as a\n * plain text import injected once as a <style> tag \u2014 see client.js.\n */\n\n/* The right inset clears the settings scrollbar: the shell's 24px content\n   padding is mostly consumed by the scrollbar thumb, so the section adds its\n   own clearance instead of ending flush against it. */\n.qol {\n  display: flex;\n  flex-direction: column;\n  gap: 12px;\n  box-sizing: border-box;\n  width: 100%;\n  max-width: 720px;\n  padding-right: 12px;\n  color: var(--dsw-alias-label-primary);\n}\n\n.qol-title {\n  margin: 0;\n  font-size: 18px;\n  font-weight: 600;\n}\n\n.qol-error {\n  margin: 0;\n  font-size: 13px;\n  color: var(--dsw-alias-state-error-primary);\n}\n\n.qol-group {\n  display: flex;\n  flex-direction: column;\n  gap: 12px;\n}\n\n.qol-groupHead {\n  margin: 0;\n  font-size: 12px;\n  font-weight: 600;\n  letter-spacing: .06em;\n  text-transform: uppercase;\n  color: var(--dsw-alias-label-tertiary);\n}\n\n.qol-field {\n  display: flex;\n  flex-direction: column;\n  gap: 6px;\n  min-width: 0;\n}\n\n.qol-fieldLabel {\n  font-size: 12px;\n  font-weight: 500;\n  color: var(--dsw-alias-label-secondary);\n}\n\n/* The switch label reads as inline text so the toggle sits beside it. */\n.qol-switchLabel {\n  font-size: 13px;\n  line-height: 1.5;\n}\n\n/* The shared Input's wrapper is inline-flex (content-sized); force it to the\n   field width so grid tracks size by the track, not the input's intrinsic\n   size (~20ch), which would overflow the settings content column. */\n.qol-input {\n  width: 100%;\n}\n\n.qol-hint {\n  margin: 0;\n  font-size: 11px;\n  line-height: 1.5;\n  color: var(--dsw-alias-label-tertiary);\n}\n\n.qol-radioRow {\n  display: flex;\n  gap: 16px;\n}\n\n.qol-radio {\n  display: inline-flex;\n  align-items: center;\n  gap: 6px;\n  font-size: 13px;\n  cursor: pointer;\n}\n\n.qol-radio input {\n  accent-color: var(--dsw-alias-brand-primary);\n}\n\n/* Multi-field rows: fluid 1fr fields with a fixed 24px column gap, so the\n   gaps stay equal across rows at any content width; the fields take the\n   remaining width (\u2248276px / \u2248176px at the current column). */\n.qol-row2 {\n  display: grid;\n  grid-template-columns: repeat(2, minmax(0, 1fr));\n  gap: 24px;\n}\n\n.qol-row3 {\n  display: grid;\n  grid-template-columns: repeat(3, minmax(0, 1fr));\n  gap: 24px;\n}\n\n/* The inactive line's effort caps stay visible but read as parked. */\n.qol-muted {\n  opacity: 0.45;\n}\n\n.qol-statusRow {\n  display: flex;\n  align-items: flex-start;\n  gap: 8px;\n  font-size: 13px;\n  line-height: 1.5;\n}\n\n.qol-statusDot {\n  flex: none;\n  margin-top: 4px;\n}\n\n/* The toggle sits right beside its label, not at the row's far edge. */\n.qol-switchHead {\n  display: flex;\n  align-items: center;\n  gap: 8px;\n}\n\n.qol-footer {\n  display: flex;\n  align-items: center;\n  gap: 10px;\n  margin-top: 8px;\n}\n\n.qol-saved {\n  font-size: 12px;\n  color: var(--dsw-alias-label-tertiary);\n}\n\n.qol-rev {\n  font-size: 11px;\n  color: var(--dsw-alias-label-dimmed);\n}\n";

// src/client.js
var React = __toESM(require("react"), 1);
var import_dsh_client_ui_primitives = require("@deepseek-ai/dsh-client-ui-primitives");
var NS = "qwen38-local-qol";
var PRESET_ID = "qwen38";
var EYE_OPEN = React.createElement(
  "svg",
  { width: 15, height: 15, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", ariaHidden: true },
  React.createElement("path", { d: "M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z" }),
  React.createElement("circle", { cx: 12, cy: 12, r: 3 })
);
var EYE_CLOSED = React.createElement(
  "svg",
  { width: 15, height: 15, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", ariaHidden: true },
  React.createElement("path", { d: "M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.17 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" }),
  React.createElement("line", { x1: 1, y1: 1, x2: 23, y2: 23 })
);
var COPY = {
  en: {
    title: "Qwen3.8 Local",
    line: "Server line",
    dialectNinfer: "NInfer",
    dialectLlamacpp: "llama.cpp",
    dialectTabbyapi: "TabbyAPI",
    dialectOmlx: "oMLX",
    connection: "Connection",
    baseURL: "Server base URL",
    model: "Model id",
    displayName: "Display name",
    apiKey: "API key",
    apiKeyHint: "Empty = keyless. When set, requests carry Authorization: Bearer <key>.",
    revealKey: "Reveal the stored key",
    concealKey: "Conceal the stored key",
    window: "Window and output",
    contextWindow: "Context window (tokens)",
    maxTokens: "Output cap (tokens)",
    thinking: "Thinking budgets",
    thinkingAll: "All efforts",
    thinkingHintNinfer: "NInfer reads its thinking budget at server startup (--default-thinking-budget); a per-request budget is not supported (ninfer as of 2026-09-14; ninfer-windows 0.7.1). Change the startup flag and restart the server.",
    thinkingHintLlamacpp: "Thinking hard cap, sent per request per selected level (overrides the server's --reasoning-budget flag).",
    thinkingHintTabbyapi: "Thinking hard cap, sent per request per selected level (TabbyAPI native reasoning_budget_tokens).",
    thinkingHintOmlx: "Thinking hard cap, sent per request per selected level (oMLX native thinking_budget).",
    compaction: "Compaction prefill trim",
    summarizeImages: "Images in the summarizer prefill",
    summarizeHint: "Off strips images in the summarizer prefill to text placeholders (prefer with mmproj offload).",
    keepTurns: "Keep reasoning of the last N turns",
    toolChars: "Tool-result character cap (0 = off)",
    save: "Save",
    saving: "Saving\u2026",
    saved: "Saved",
    loading: "Loading\u2026",
    notFound: "This plugin is not registered a settings section on the host side (restart DSH web after installing the plugin, then open this page again).",
    conflict: "Someone else changed these settings while you were editing. Your edits were discarded; the current values are shown.",
    invalidNumber: "Every number field must be a positive whole number.",
    remoteError: "Settings request failed: ",
    compactionNotSet: "Local compaction is not set up \u2014 the trim controls below apply once the qwen38 preset is generated (one-time setup, see the plugin README).",
    compactionActive: "Local compaction is active for new sessions (default preset: qwen38).",
    compactionAvailable: 'Local compaction is available, but the default preset is "{default}" \u2014 new sessions use standard compaction. Select qwen38 on the Agent presets page to enable it.',
    compactionHint: "The trim controls apply to sessions using the qwen38 preset."
  },
  zh: {
    title: "Qwen3.8 \u672C\u5730",
    line: "\u670D\u52A1\u5668\u7EBF",
    dialectNinfer: "NInfer",
    dialectLlamacpp: "llama.cpp",
    dialectTabbyapi: "TabbyAPI",
    dialectOmlx: "oMLX",
    connection: "\u8FDE\u63A5",
    baseURL: "\u670D\u52A1\u5668\u5730\u5740",
    model: "\u6A21\u578B id",
    displayName: "\u663E\u793A\u540D",
    apiKey: "\u63A5\u53E3\u5BC6\u94A5\uFF08API key\uFF09",
    apiKeyHint: "\u7559\u7A7A = \u65E0\u8BA4\u8BC1\uFF1B\u586B\u5199\u540E\u8BF7\u6C42\u5E26 Authorization: Bearer <key>\u3002",
    revealKey: "\u663E\u793A\u5DF2\u5B58\u7684\u5BC6\u94A5",
    concealKey: "\u9690\u85CF\u5DF2\u5B58\u7684\u5BC6\u94A5",
    window: "\u7A97\u53E3\u4E0E\u8F93\u51FA",
    contextWindow: "\u4E0A\u4E0B\u6587\u7A97\u53E3\uFF08token\uFF09",
    maxTokens: "\u8F93\u51FA\u4E0A\u9650\uFF08token\uFF09",
    thinking: "Thinking \u9884\u7B97",
    thinkingAll: "\u5168\u90E8 effort",
    thinkingHintNinfer: "NInfer \u7684 thinking \u9884\u7B97\u5728\u670D\u52A1\u542F\u52A8\u65F6\u8BBE\u5B9A\uFF08--default-thinking-budget \u542F\u52A8\u53C2\u6570\uFF0C\u4E0D\u652F\u6301\u9010\u8BF7\u6C42\uFF0Cninfer as of 2026-09-14\uFF1Bninfer-windows 0.7.1\uFF09\u3002\u6539\u542F\u52A8\u53C2\u6570\u540E\u91CD\u542F\u670D\u52A1\u751F\u6548\u3002",
    thinkingHintLlamacpp: "thinking \u786C\u5E3D\uFF0C\u9010\u8BF7\u6C42\u6309\u6240\u9009\u6863\u53D1\u9001\uFF08\u8986\u76D6\u670D\u52A1\u7AEF --reasoning-budget\uFF09\u3002",
    thinkingHintTabbyapi: "thinking \u786C\u5E3D\uFF0C\u9010\u8BF7\u6C42\u6309\u6240\u9009\u6863\u53D1\u9001\uFF08TabbyAPI \u539F\u751F reasoning_budget_tokens\uFF09\u3002",
    thinkingHintOmlx: "thinking \u786C\u5E3D\uFF0C\u9010\u8BF7\u6C42\u6309\u6240\u9009\u6863\u53D1\u9001\uFF08oMLX \u539F\u751F thinking_budget\uFF09\u3002",
    compaction: "\u538B\u7F29\u9884\u586B\u5145\u88C1\u526A",
    summarizeImages: "\u6458\u8981\u9884\u586B\u5145\u91CC\u7684\u56FE\u7247",
    summarizeHint: "\u5173\u95ED = \u6458\u8981\u9884\u586B\u5145\u91CC\u7684\u56FE\u7247\u66FF\u6362\u4E3A\u6587\u672C\u5360\u4F4D\u7B26\uFF08mmproj offload \u65F6\u4F18\u9009\uFF09\u3002",
    keepTurns: "\u4FDD\u7559\u6700\u8FD1 N \u8F6E\u7684 reasoning",
    toolChars: "\u5DE5\u5177\u7ED3\u679C\u5B57\u6570\u5E3D\uFF080 = \u5173\uFF09",
    save: "\u4FDD\u5B58",
    saving: "\u4FDD\u5B58\u4E2D\u2026",
    saved: "\u5DF2\u4FDD\u5B58",
    loading: "\u52A0\u8F7D\u4E2D\u2026",
    notFound: "\u5BBF\u4E3B\u4FA7\u672A\u6CE8\u518C\u8BE5\u63D2\u4EF6\u7684\u8BBE\u7F6E\u547D\u540D\u7A7A\u95F4\uFF08\u88C5\u5B8C\u63D2\u4EF6\u540E\u91CD\u542F DSH web\uFF0C\u518D\u6253\u5F00\u672C\u9875\u9762\uFF09\u3002",
    conflict: "\u7F16\u8F91\u671F\u95F4\u4ED6\u4EBA\u4FEE\u6539\u4E86\u8FD9\u4E9B\u8BBE\u7F6E\u3002\u4F60\u7684\u6539\u52A8\u5DF2\u4E22\u5F03\uFF0C\u5F53\u524D\u663E\u793A\u7684\u662F\u6700\u65B0\u503C\u3002",
    invalidNumber: "\u6240\u6709\u6570\u5B57\u5B57\u6BB5\u5FC5\u987B\u662F\u6B63\u6574\u6570\u3002",
    remoteError: "\u8BBE\u7F6E\u8BF7\u6C42\u5931\u8D25\uFF1A",
    compactionNotSet: "\u672C\u5730\u538B\u7F29\u672A\u542F\u7528\u2014\u2014\u751F\u6210 qwen38 \u9884\u8BBE\uFF08\u4E00\u6B21\u6027 setup\uFF0C\u89C1\u63D2\u4EF6 README\uFF09\u540E\uFF0C\u4E0B\u65B9\u88C1\u526A\u8BBE\u7F6E\u624D\u4F1A\u751F\u6548\u3002",
    compactionActive: "\u672C\u5730\u538B\u7F29\u5BF9\u65B0\u4F1A\u8BDD\u751F\u6548\uFF08\u9ED8\u8BA4\u9884\u8BBE\uFF1Aqwen38\uFF09\u3002",
    compactionAvailable: '\u672C\u5730\u538B\u7F29\u53EF\u7528\uFF0C\u4F46\u9ED8\u8BA4\u9884\u8BBE\u662F "{default}"\u2014\u2014\u65B0\u4F1A\u8BDD\u8D70\u6807\u51C6\u538B\u7F29\u3002\u5728 Agent \u9884\u8BBE\u9875\u9009\u62E9 qwen38 \u542F\u7528\u3002',
    compactionHint: "\u88C1\u526A\u8BBE\u7F6E\u4EC5\u5BF9 qwen38 \u9884\u8BBE\u7684\u4F1A\u8BDD\u751F\u6548\u3002"
  }
};
function compactionStatusCopy(status, t) {
  if (status === void 0 || status.presetGenerated !== true) return t.compactionNotSet;
  if (status.defaultPreset === PRESET_ID) return t.compactionActive;
  return t.compactionAvailable.replace("{default}", String(status.defaultPreset));
}
function compactionStatusState(status) {
  if (status === void 0 || status.presetGenerated !== true) return "idle";
  if (status.defaultPreset === PRESET_ID) return "done";
  return "warning";
}
function Field({ label, children }) {
  return React.createElement(
    "div",
    { className: "qol-field" },
    React.createElement("label", { className: "qol-fieldLabel" }, label),
    children
  );
}
function digitsOnly(setValue) {
  return (e) => {
    setValue(e.target.value.replace(/\D/g, ""));
  };
}
var LINE_WINDOW_DEFAULTS = Object.freeze({
  ninfer: { contextWindow: 262144, maxTokens: 52428 },
  llamacpp: { contextWindow: 262144, maxTokens: 52428 },
  tabbyapi: { contextWindow: 262144, maxTokens: 52428 },
  omlx: { contextWindow: 262144, maxTokens: 52428 }
});
function lineRecord(name2, raw, fallback) {
  const d = LINE_WINDOW_DEFAULTS[name2];
  const src = { contextWindow: d.contextWindow, maxTokens: d.maxTokens, ...fallback ?? {}, ...raw ?? {} };
  return {
    baseURL: src.baseURL ?? "",
    model: src.model ?? "",
    displayName: src.displayName ?? "",
    apiKey: src.apiKey ?? "",
    contextWindow: String(src.contextWindow ?? d.contextWindow),
    maxTokens: String(src.maxTokens ?? d.maxTokens),
    low: String(src.thinkingBudgets?.low ?? 4096),
    medium: String(src.thinkingBudgets?.medium ?? 8192),
    xhigh: String(src.thinkingBudgets?.xhigh ?? 16384),
    defaultThinkingBudget: String(src.defaultThinkingBudget ?? 16384),
    images: src.summarize?.images ?? "strip",
    keepTurns: String(src.summarize?.keepTurns ?? 5),
    toolChars: String(src.summarize?.toolChars ?? 2e3)
  };
}
function toDraft(value) {
  const dialect = value.dialect;
  const legacy = (value.user ?? {}).lines === void 0;
  const legacyTop = legacy ? {
    baseURL: value.baseURL,
    model: value.model,
    displayName: value.displayName,
    contextWindow: value.contextWindow,
    maxTokens: value.maxTokens,
    thinkingBudgets: value.thinkingBudgets,
    defaultThinkingBudget: value.defaultThinkingBudget,
    summarize: value.summarize,
    apiKey: value.apiKey
  } : void 0;
  const lines = {
    ninfer: lineRecord("ninfer", value.lines?.ninfer, dialect === "ninfer" ? legacyTop : void 0),
    llamacpp: lineRecord("llamacpp", value.lines?.llamacpp, dialect === "llamacpp" ? legacyTop : void 0),
    tabbyapi: lineRecord("tabbyapi", value.lines?.tabbyapi, dialect === "tabbyapi" ? legacyTop : void 0),
    omlx: lineRecord("omlx", value.lines?.omlx, dialect === "omlx" ? legacyTop : void 0)
  };
  const active = lines[dialect];
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
    apiKey: active.apiKey
  };
}
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
    toolChars: record.toolChars
  };
}
function QwenLocalSectionEntry({ useLocale, load, save }) {
  const locale = useLocale((snapshot) => snapshot.active === "zh" ? "zh" : "en");
  const t = COPY[locale];
  const [state, setState] = React.useState({ status: "loading", error: null, view: null, draft: null, busy: false, saved: false, agentPresets: null });
  const [revealedKey, setRevealedKey] = React.useState(false);
  const setDraft = (patch) => setState((s) => ({ ...s, draft: s.draft === null ? s.draft : { ...s.draft, ...patch }, saved: false }));
  const switchDialect = (next) => {
    setState((s) => {
      if (s.draft === null || s.draft.dialect === next) return s;
      const d = s.draft;
      return {
        ...s,
        saved: false,
        draft: { ...d, dialect: next, ...liftedInputs(d.lines[next]) }
      };
    });
  };
  React.useEffect(() => {
    let alive = true;
    load().then((result) => {
      if (!alive) return;
      if (result.ok) setState({ status: "ready", error: null, view: result.value, draft: toDraft(result.value.value), busy: false, saved: false, agentPresets: result.agentPresets ?? null });
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
      draft2.defaultBudget,
      draft2.keepTurns,
      draft2.toolChars,
      ...Object.values(draft2.lines).flatMap((line) => [line.contextWindow, line.maxTokens, line.low, line.medium, line.xhigh, line.defaultThinkingBudget, line.keepTurns, line.toolChars])
    ];
    if (numbers.some((text) => /^\d+$/.test(String(text)) === false || Number.parseInt(text, 10) <= 0)) {
      setState((s) => ({ ...s, error: t.invalidNumber }));
      return;
    }
    setState((s) => ({ ...s, busy: true, error: null }));
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
        xhigh: Number.parseInt(record.xhigh, 10)
      },
      defaultThinkingBudget: Number.parseInt(record.defaultThinkingBudget, 10),
      summarize: {
        images: record.images,
        keepTurns: Number.parseInt(record.keepTurns, 10),
        toolChars: Number.parseInt(record.toolChars, 10)
      }
    });
    const activeRecord = {
      ...draft2.lines[draft2.dialect],
      baseURL: draft2.baseURL,
      model: draft2.model,
      displayName: draft2.displayName,
      contextWindow: draft2.contextWindow,
      maxTokens: draft2.maxTokens,
      low: draft2.low,
      medium: draft2.medium,
      xhigh: draft2.xhigh,
      defaultThinkingBudget: draft2.defaultBudget,
      images: draft2.images,
      keepTurns: draft2.keepTurns,
      toolChars: draft2.toolChars
    };
    const persistedLines = { ...draft2.lines, [draft2.dialect]: activeRecord };
    const patch = {
      dialect: draft2.dialect,
      baseURL: draft2.baseURL,
      model: draft2.model,
      displayName: draft2.displayName,
      // The credential rides the section top level, not a line record.
      apiKey: draft2.apiKey,
      lines: {
        ninfer: lineBlock(persistedLines.ninfer),
        llamacpp: lineBlock(persistedLines.llamacpp),
        tabbyapi: lineBlock(persistedLines.tabbyapi),
        omlx: lineBlock(persistedLines.omlx)
      },
      contextWindow: Number.parseInt(draft2.contextWindow, 10),
      maxTokens: Number.parseInt(draft2.maxTokens, 10),
      thinkingBudgets: {
        low: Number.parseInt(draft2.low, 10),
        medium: Number.parseInt(draft2.medium, 10),
        xhigh: Number.parseInt(draft2.xhigh, 10)
      },
      defaultThinkingBudget: Number.parseInt(draft2.defaultBudget, 10),
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
      if (fresh.ok) setState({ status: "ready", error: t.conflict, view: fresh.value, draft: toDraft(fresh.value.value), busy: false, saved: false, agentPresets: fresh.agentPresets ?? null });
      else setState((s) => ({ ...s, busy: false, error: t.remoteError + fresh.error }));
    } else {
      setState((s) => ({ ...s, busy: false, error: t.remoteError + result.error }));
    }
  };
  if (state.status === "loading") {
    return React.createElement("div", { className: "qol" }, t.loading);
  }
  if (state.status === "error") {
    return React.createElement("div", { className: "qol" }, state.error);
  }
  const { view, draft } = state;
  const compaction = {
    presetGenerated: (view.value.compaction ?? { presetGenerated: false }).presetGenerated,
    defaultPreset: state.agentPresets?.defaultPreset ?? view.value.compaction?.defaultPreset ?? "standard"
  };
  const ninfer = draft.dialect === "ninfer";
  return React.createElement(
    "div",
    { className: "qol" },
    React.createElement("h2", { className: "qol-title" }, t.title),
    state.error !== null ? React.createElement("p", { className: "qol-error", role: "alert" }, state.error) : null,
    // Server line: the headline control — it switches the thinking wire for
    // every request the plugin route serves.
    React.createElement(
      "section",
      { className: "qol-group" },
      React.createElement("h3", { className: "qol-groupHead" }, t.line),
      React.createElement(
        "div",
        { className: "qol-radioRow" },
        ["llamacpp", "ninfer", "tabbyapi", "omlx"].map(
          (dialect) => React.createElement(
            "label",
            { key: dialect, className: "qol-radio" },
            React.createElement("input", {
              type: "radio",
              name: "qwen38-dialect",
              checked: draft.dialect === dialect,
              onChange: () => {
                switchDialect(dialect);
              }
            }),
            dialect === "ninfer" ? t.dialectNinfer : dialect === "tabbyapi" ? t.dialectTabbyapi : dialect === "omlx" ? t.dialectOmlx : t.dialectLlamacpp
          )
        )
      )
    ),
    React.createElement(
      "section",
      { className: "qol-group" },
      React.createElement("h3", { className: "qol-groupHead" }, t.connection),
      React.createElement(
        Field,
        { label: t.baseURL },
        React.createElement(import_dsh_client_ui_primitives.Input, { className: "qol-input", value: draft.baseURL, onChange: (e) => {
          setDraft({ baseURL: e.target.value });
        } })
      ),
      React.createElement(
        Field,
        { label: t.model },
        React.createElement(import_dsh_client_ui_primitives.Input, { className: "qol-input", value: draft.model, onChange: (e) => {
          setDraft({ model: e.target.value });
        } })
      ),
      React.createElement(
        Field,
        { label: t.displayName },
        React.createElement(import_dsh_client_ui_primitives.Input, { className: "qol-input", value: draft.displayName, onChange: (e) => {
          setDraft({ displayName: e.target.value });
        } })
      ),
      React.createElement(
        Field,
        { label: t.apiKey },
        // The eye toggle overlays the right edge of the key input (close-aligned
        // to the slot) and swaps between the open and closed icons on click.
        React.createElement(
          "div",
          { style: { position: "relative" } },
          React.createElement(import_dsh_client_ui_primitives.Input, {
            className: "qol-input",
            type: revealedKey ? "text" : "password",
            value: draft.apiKey,
            onChange: (e) => {
              setDraft({ apiKey: e.target.value });
            },
            style: { paddingRight: 34 }
          }),
          React.createElement("button", {
            type: "button",
            title: revealedKey ? t.concealKey : t.revealKey,
            onClick: () => {
              setRevealedKey((v) => !v);
            },
            style: {
              position: "absolute",
              right: 6,
              top: "50%",
              transform: "translateY(-50%)",
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "#8b93a7",
              padding: 4,
              display: "flex",
              alignItems: "center"
            }
          }, revealedKey ? EYE_OPEN : EYE_CLOSED)
        )
      ),
      React.createElement("p", { className: "qol-hint" }, t.apiKeyHint)
    ),
    React.createElement(
      "section",
      { className: "qol-group" },
      React.createElement("h3", { className: "qol-groupHead" }, t.window),
      React.createElement(
        "div",
        { className: "qol-row2" },
        React.createElement(
          Field,
          { label: t.contextWindow },
          React.createElement(import_dsh_client_ui_primitives.Input, { className: "qol-input", inputMode: "numeric", value: draft.contextWindow, onChange: digitsOnly((v) => {
            setDraft({ contextWindow: v });
          }) })
        ),
        React.createElement(
          Field,
          { label: t.maxTokens },
          React.createElement(import_dsh_client_ui_primitives.Input, { className: "qol-input", inputMode: "numeric", value: draft.maxTokens, onChange: digitsOnly((v) => {
            setDraft({ maxTokens: v });
          }) })
        )
      )
    ),
    React.createElement(
      "section",
      { className: "qol-group" },
      React.createElement("h3", { className: "qol-groupHead" }, t.thinking),
      React.createElement(
        "div",
        { className: ninfer ? "qol-row3 qol-muted" : "qol-row3" },
        ["low", "medium", "xhigh"].map(
          (effort) => React.createElement(
            Field,
            { key: effort, label: effort },
            React.createElement(import_dsh_client_ui_primitives.Input, { className: "qol-input", inputMode: "numeric", disabled: ninfer, value: draft[effort], onChange: digitsOnly((v) => {
              setDraft({ [effort]: v });
            }) })
          )
        )
      ),
      React.createElement("p", { className: "qol-hint" }, ninfer ? t.thinkingHintNinfer : draft.dialect === "tabbyapi" ? t.thinkingHintTabbyapi : draft.dialect === "omlx" ? t.thinkingHintOmlx : t.thinkingHintLlamacpp)
    ),
    // Compaction: the wiring status first (the trim controls only apply to
    // sessions using the qwen38 preset), then the trim knobs.
    React.createElement(
      "section",
      { className: "qol-group" },
      React.createElement("h3", { className: "qol-groupHead" }, t.compaction),
      React.createElement(
        "div",
        { className: "qol-statusRow" },
        React.createElement(import_dsh_client_ui_primitives.StateDot, { state: compactionStatusState(compaction), className: "qol-statusDot" }),
        compactionStatusCopy(compaction, t)
      ),
      React.createElement("p", { className: "qol-hint" }, t.compactionHint),
      React.createElement(
        "div",
        { className: "qol-field" },
        React.createElement(
          "div",
          { className: "qol-switchHead" },
          React.createElement("span", { className: "qol-switchLabel" }, t.summarizeImages),
          React.createElement(import_dsh_client_ui_primitives.Switch, {
            checked: draft.images === "keep",
            onChange: (next) => {
              setDraft({ images: next ? "keep" : "strip" });
            },
            label: t.summarizeImages
          })
        ),
        React.createElement("p", { className: "qol-hint" }, t.summarizeHint)
      ),
      React.createElement(
        "div",
        { className: "qol-row2" },
        React.createElement(
          Field,
          { label: t.keepTurns },
          React.createElement(import_dsh_client_ui_primitives.Input, { className: "qol-input", inputMode: "numeric", value: draft.keepTurns, onChange: digitsOnly((v) => {
            setDraft({ keepTurns: v });
          }) })
        ),
        React.createElement(
          Field,
          { label: t.toolChars },
          React.createElement(import_dsh_client_ui_primitives.Input, { className: "qol-input", inputMode: "numeric", value: draft.toolChars, onChange: digitsOnly((v) => {
            setDraft({ toolChars: v });
          }) })
        )
      )
    ),
    React.createElement(
      "div",
      { className: "qol-footer" },
      React.createElement(import_dsh_client_ui_primitives.Button, { variant: "primary", disabled: state.busy, onClick: () => {
        void doSave();
      } }, state.busy ? t.saving : t.save),
      state.saved ? React.createElement("span", { className: "qol-saved" }, t.saved) : null,
      state.busy === false && view !== null ? React.createElement("span", { className: "qol-rev" }, `r${view.revision}`) : null
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
          const presets = response.value.namespaces.find((entry) => entry.ns === "agent-presets");
          return {
            ok: true,
            value: view,
            agentPresets: presets === void 0 ? null : { revision: presets.revision, defaultPreset: presets.value?.default ?? null }
          };
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

// src/client-entry.js
if (typeof document !== "undefined" && document.querySelector("style[data-dsh-qol]") === null) {
  const style = document.createElement("style");
  style.setAttribute("data-dsh-qol", "");
  style.textContent = client_default;
  document.head.appendChild(style);
}

    return module.exports;
  },
});
