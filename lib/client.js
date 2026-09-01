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
  name: () => name
});
module.exports = __toCommonJS(client_exports);
var React = __toESM(require("react"), 1);
var NS = "qwen38-local-qol";
var COPY = {
  en: {
    title: "Qwen3.8 Local",
    line: "Server line",
    dialectNinfer: "NInfer (8082)",
    dialectLlamacpp: "llama.cpp (8080)",
    connection: "Connection",
    baseURL: "Server base URL",
    model: "Model id",
    displayName: "Display name",
    window: "Window and output",
    contextWindow: "Context window (tokens)",
    maxTokens: "Output cap (tokens)",
    includeUsage: "Request usage reporting (context meter)",
    thinking: "Thinking budgets",
    thinkingHint: "Hard per-effort thinking-token caps. On NInfer the server ignores the field and its own --default-thinking-budget caps thinking; on llama.cpp each request carries it.",
    defaultEffort: "Default effort (undeclared requests)",
    off: "off",
    compaction: "Compaction prefill trim",
    summarizeImages: "Images in the summarizer prefill",
    strip: "strip to placeholders",
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
    dialectNinfer: "NInfer (8082)",
    dialectLlamacpp: "llama.cpp (8080)",
    connection: "\u8FDE\u63A5",
    baseURL: "\u670D\u52A1\u5668\u5730\u5740",
    model: "\u6A21\u578B id",
    displayName: "\u663E\u793A\u540D",
    window: "\u7A97\u53E3\u4E0E\u8F93\u51FA",
    contextWindow: "\u4E0A\u4E0B\u6587\u7A97\u53E3\uFF08token\uFF09",
    maxTokens: "\u8F93\u51FA\u4E0A\u9650\uFF08token\uFF09",
    includeUsage: "\u8BF7\u6C42 usage \u4E0A\u62A5\uFF08\u4E0A\u4E0B\u6587\u5C0F\u5708\uFF09",
    thinking: "Thinking \u9884\u7B97",
    thinkingHint: "\u5404 effort \u6863\u7684 thinking token \u786C\u5E3D\u3002NInfer \u670D\u52A1\u7AEF\u4F1A\u5FFD\u7565\u8BE5\u5B57\u6BB5\uFF08\u5B9E\u9645\u5E3D = \u542F\u52A8\u53C2\u6570\u7684 --default-thinking-budget\uFF09\uFF1Bllama.cpp \u7EBF\u9010\u8BF7\u6C42\u643A\u5E26\u3002",
    defaultEffort: "\u9ED8\u8BA4\u6863\uFF08\u672A\u58F0\u660E\u8BF7\u6C42\u7684\u751F\u6548\u6863\uFF09",
    off: "off",
    compaction: "\u538B\u7F29\u9884\u586B\u5145\u88C1\u526A",
    summarizeImages: "\u6458\u8981\u9884\u586B\u5145\u91CC\u7684\u56FE\u7247",
    strip: "\u66FF\u6362\u4E3A\u5360\u4F4D\u7B26",
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
var BUTTON_STYLE = {
  padding: "6px 18px",
  fontSize: 13,
  border: "none",
  borderRadius: 6,
  background: "rgba(128, 128, 128, 0.25)",
  color: "inherit",
  cursor: "pointer"
};
function toDraft(value) {
  return {
    dialect: value.dialect,
    baseURL: value.baseURL,
    model: value.model,
    displayName: value.displayName ?? "",
    contextWindow: String(value.contextWindow),
    maxTokens: String(value.maxTokens),
    includeUsage: value.includeUsage === true,
    low: String(value.thinkingBudgets?.low ?? ""),
    medium: String(value.thinkingBudgets?.medium ?? ""),
    xhigh: String(value.thinkingBudgets?.xhigh ?? ""),
    defaultEffort: value.defaultEffort ?? "off",
    images: value.summarize?.images ?? "strip",
    keepTurns: String(value.summarize?.keepTurns ?? ""),
    toolChars: String(value.summarize?.toolChars ?? "")
  };
}
function QwenLocalSectionEntry({ useLocale, load, save }) {
  const locale = useLocale((snapshot) => snapshot.active === "zh" ? "zh" : "en");
  const t = COPY[locale];
  const [state, setState] = React.useState({ status: "loading", error: null, view: null, draft: null, busy: false, saved: false });
  const setDraft = (patch) => setState((s) => ({ ...s, draft: s.draft === null ? s.draft : { ...s.draft, ...patch }, saved: false }));
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
    const numbers = [draft2.contextWindow, draft2.maxTokens, draft2.low, draft2.medium, draft2.xhigh, draft2.keepTurns, draft2.toolChars];
    if (numbers.some((text) => /^\d+$/.test(String(text)) === false || Number.parseInt(text, 10) <= 0)) {
      setState((s) => ({ ...s, error: t.invalidNumber }));
      return;
    }
    setState((s) => ({ ...s, busy: true, error: null }));
    const patch = {
      dialect: draft2.dialect,
      baseURL: draft2.baseURL,
      model: draft2.model,
      displayName: draft2.displayName,
      contextWindow: Number.parseInt(draft2.contextWindow, 10),
      maxTokens: Number.parseInt(draft2.maxTokens, 10),
      includeUsage: draft2.includeUsage,
      thinkingBudgets: {
        low: Number.parseInt(draft2.low, 10),
        medium: Number.parseInt(draft2.medium, 10),
        xhigh: Number.parseInt(draft2.xhigh, 10)
      },
      defaultEffort: draft2.defaultEffort,
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
    return React.createElement("div", null, t.loading);
  }
  if (state.status === "error") {
    return React.createElement("div", null, state.error);
  }
  const { view, draft } = state;
  return React.createElement(
    "div",
    { style: { maxWidth: 560 } },
    React.createElement("h2", { style: { marginTop: 0 } }, t.title),
    state.error !== null ? React.createElement("div", { style: { fontSize: 12, opacity: 0.8, marginBottom: 12 } }, state.error) : null,
    React.createElement(
      "div",
      null,
      React.createElement("div", { style: { fontSize: 12, marginBottom: 4, opacity: 0.75 } }, t.line),
      React.createElement(
        "div",
        { style: { display: "flex", gap: 16, marginBottom: 16 } },
        ["ninfer", "llamacpp"].map(
          (dialect) => React.createElement(
            "label",
            { key: dialect, style: { display: "flex", gap: 6, alignItems: "center", fontSize: 13, cursor: "pointer" } },
            React.createElement("input", {
              type: "radio",
              name: "qwen38-dialect",
              checked: draft.dialect === dialect,
              onChange: () => setDraft({ dialect })
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
      ),
      React.createElement(
        "label",
        { style: { display: "flex", gap: 6, alignItems: "center", fontSize: 13, cursor: "pointer", marginBottom: 16 } },
        React.createElement("input", {
          type: "checkbox",
          checked: draft.includeUsage,
          onChange: (e) => setDraft({ includeUsage: e.target.checked })
        }),
        t.includeUsage
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
      React.createElement(
        Field,
        { label: t.defaultEffort },
        React.createElement(
          "select",
          { style: INPUT_STYLE, value: draft.defaultEffort, onChange: (e) => setDraft({ defaultEffort: e.target.value }) },
          React.createElement("option", { value: "off" }, t.off),
          ["low", "medium", "xhigh"].map((effort) => React.createElement("option", { key: effort, value: effort }, effort))
        )
      ),
      React.createElement("div", { style: { fontSize: 11, opacity: 0.6, marginTop: 4, lineHeight: 1.4 } }, t.thinkingHint)
    ),
    React.createElement(
      "div",
      null,
      React.createElement("div", { style: { fontSize: 12, marginBottom: 4, opacity: 0.75 } }, t.compaction),
      React.createElement(
        Field,
        { label: t.summarizeImages },
        React.createElement(
          "select",
          { style: INPUT_STYLE, value: draft.images, onChange: (e) => setDraft({ images: e.target.value }) },
          React.createElement("option", { value: "strip" }, t.strip),
          React.createElement("option", { value: "keep" }, t.keep)
        )
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
var inject = ["slots", "locale", "remote"];

    return module.exports;
  },
});
