# dsh-qwen38-local-qol

[English](#dsh-qwen38-local-qol) · [中文](#中文)

A QoL plugin for DSH (DeepSeek Harness) for people running **Qwen3.8
locally** — **Qwen3.8-27B** on llama.cpp `llama-server` or on NInfer
([Neroued/ninfer](https://github.com/Neroued/ninfer): the upstream
**ninfer 0.5.0** release (Docker image) and **ninfer-windows 0.5.0**
(native Windows build); both serve the same OpenAI-compatible `/v1` API,
so one plugin config covers either), and, at the config level,
**Qwen3.8-Flash-Next** (same OpenAI-compatible wire, same dialect logic).

It gives stock DSH (no core patches, no pi-ai patchfile) two things the local
Qwen line needs:

1. **Per-request thinking budgets.** Each request carries the selected
   reasoning effort and its hard thinking-token cap: `llamacpp` dialect sends
   `chat_template_kwargs.reasoning_effort` + top-level
   `reasoning_budget_tokens` (llama.cpp's per-request budget, which overrides
   any `--reasoning-budget` CLI flag); `ninfer` dialect sends the top-level
   `reasoning_effort` (NInfer 0.5.0's effort whitelist; the budget field is
   sent but the server caps thinking with `--default-thinking-budget`).
   `off` sends `chat_template_kwargs.enable_thinking: false` — the toggle
   this llama.cpp build actually reads.
2. **A compaction backend that stops burning the output cap on thinking.**
   The stock engine's sole `summarize()` hook is overridden so the summarizer
   prefill is trimmed first (recent reasoning only, images stripped, tool
   results capped) and the one-shot call keeps thinking off — the checkpoint
   gets the whole output cap instead of a truncated "incomplete checkpoint".

One package, three registrations:

| Registration | Seam | Mount |
|---|---|---|
| `QwenLocalAdapter` (provider route `qwen38`) | `ctx.llm.registerAdapter()` | the bundle patch (`cordis.patch.yml`) on the profile root |
| `QwenLocalCompaction` (compaction backend) | subclass of `@deepseek-ai/dsh-compaction-basic` | the generated **user preset** `~/.dsh/.agent-presets/qwen38-qol/agent.cordis.yml` (the per-session agent preset owns the isolated compaction group; profile-level patches do not reach it) |
| settings tab (**Qwen3.8 Local**) | user-settings namespace `qwen38-local-qol` + the browser `settings.section` slot | the settings provider's `installSection` (host) and the plugin's `dsh.client` manifest (browser, the `./client` export) |

## Install

```sh
dsh plugin add github:Yunado/dsh-qwen38-local-qol
# generate the user preset from the installed standard preset (dated backup on re-run):
node_modules/dsh-qwen38-local-qol/src/setup.js --src <path to the installed @deepseek-ai/dsh-agent-presets presets/standard/agent.cordis.yml>
```

Then select the **`qwen38-qol`** agent preset in the GUI (per session).

`dsh --profile <name> --patch <plugin>/cordis.patch.yml --dump-config` shows
the composed provider row without booting.

## Configuration

The provider row config (from the bundle patch or an overlay; an id-targeted
patch replaces the whole config object, so environment fallbacks apply to the
fields the patch leaves out):

| Field | Env fallback | Default | Meaning |
|---|---|---|---|
| `baseURL` | `DSH_QWEN38_BASE_URL` | `http://127.0.0.1:8082/v1` | server base, including `/v1` |
| `model` | `DSH_QWEN38_MODEL` | `qwen3.8-27b-nvfp4-uncensored` | model id sent when a request omits one (the NInfer 0.5.0 artifact id — same for the Docker and the Windows build; verify against the running server with `GET /v1/models`; the llama.cpp line serves its own id — set this field or the env there) |
| `displayName` | `DSH_QWEN38_DISPLAY_NAME` | the model id | human-readable name for the GUI model selector (the wire id is an artifact alias) |
| `apiKey` | `DSH_QWEN38_API_KEY` | — | server `--api-key`, when set |
| `dialect` | `DSH_QWEN38_DIALECT` | `ninfer` | `ninfer` or `llamacpp` (the thinking wire) |
| `contextWindow` | `DSH_QWEN38_CONTEXT_WINDOW` | `229376` | declared context capacity (pressure compaction requires it) |
| `maxTokens` | `DSH_QWEN38_MAX_TOKENS` | `24576` | declared per-request output cap |
| `thinkingBudgets` | — | `{ low: 4096, medium: 8192, xhigh: 16384 }` | per-effort hard thinking budgets; the declared effort vocabulary is `off` + these keys (NInfer line: sent but ignored — the effective cap is `defaultThinkingBudget` / the server flag) |
| `defaultThinkingBudget` | — | `16384` | the NInfer line's effective thinking cap: the server's `--default-thinking-budget` flag value, one value for all efforts (the NInfer endpoint has no per-request budget field). Recorded by the settings tab — keep it in sync with the server startup flags |
| `defaultEffort` | `DSH_QWEN38_DEFAULT_EFFORT` | `medium` | effort materialized into requests that omit one; must be `off` or a `thinkingBudgets` key. Declaring it (any value) suppresses the core selector's "Default" row, which is redundant with `off` on this line |
| `thinkingLevelMap` | — | identity | effort id → wire effort name |
| `includeUsage` | — | `true` | request `stream_options.include_usage`; the context meter and per-turn reasoning-token display read the server-reported usage (both dialects verified to honor it) |
| `provider` | — | `["qwen38"]` | the provider route(s) to register |

Compaction trim knobs (environment only, so the preset row carries no keys the
stock config schema does not know):

| Env | Default | Meaning |
|---|---|---|
| `DSH_QWEN38_SUMMARIZE_IMAGES` | `strip` | `strip` reduces image blocks to text placeholders — **prefer this when the vision mmproj is offloaded to a second device** (common local setups, e.g. llama.cpp `--mmproj-device <iGPU>`): the summarizer then never re-encodes images on the offload device. `keep` retains them so the checkpoint can describe the pixels (every compaction re-encodes the images — slower + vision tokens) |
| `DSH_QWEN38_SUMMARIZE_KEEP_TURNS` | `5` | assistant turns at the region tail whose reasoning is kept |
| `DSH_QWEN38_SUMMARIZE_TOOL_CHARS` | `2000` | per-tool-result character cap; `0` disables |

The generated preset pins the backend row's `maxTokens` to `16384` (the stock
8192 default is the cap thinking used to eat before this backend existed).

## Settings tab

On a profile with the settings provider (the web surface), the plugin registers
the user-settings namespace `qwen38-local-qol` and a **Qwen3.8 Local** page in
the settings dialog. The tab exposes the provider config a human actually
adjusts: the server line selector (llama.cpp / NInfer, i.e. the `dialect`
field — ports stay out of the labels because they are user-chosen), the
connection fields (`baseURL`, `model`, `displayName`) **per dialect**,
`contextWindow`, `maxTokens`, the per-effort `thinkingBudgets` (greyed out on
the NInfer line) plus the single `defaultThinkingBudget` (NInfer line only),
and the
compaction trim knobs (`summarize.images` / `summarize.keepTurns` /
`summarize.toolChars`) — plus a revision indicator and conflict handling for
concurrent edits.

- **Per-dialect line memory**: the section persists a `lines` block
  (`lines.ninfer` / `lines.llamacpp`) where each line remembers its own
  connection (`baseURL` / `model` / `displayName`) **and** its own window
  numbers (`contextWindow` / `maxTokens` / `thinkingBudgets`). The context
  window is a property of the line's server build (its `-c`, bounded by that
  line's VRAM and quantization), not of the model — two lines of the same
  model may legitimately carry different windows, and a shared window would
  miscalibrate the compaction threshold of the smaller one. The top-level
  fields stay the adapter's authority (the tab writes them in sync with the
  active line), so the host side needs no line awareness; a section saved
  before `lines` existed is migrated transparently. Switching the line in the
  tab swaps the two remembered lines; switching back restores the previous
  line's values. The compaction trim knobs (`summarize`) stay shared: they
  describe model behavior, not the line.
- **Dialect-aware thinking-budget fields**: on the NInfer line the per-effort
  numbers are greyed out (NInfer has no per-request thinking budget —
  ninfer 0.5.0 / ninfer-windows 0.5.0; the values are sent but ignored), and a
  single **default thinking budget** field records the server's
  `--default-thinking-budget` flag value (one value for all efforts). On the
  llama.cpp line the per-effort fields stay live (honored per request).
- **Fill-once defaults**: every window number (229376 / 24576 /
  4096-8192-16384 per line), the trim knobs (strip / 5 / 2000), and each
  line's production connection (NInfer 8082 + the 27B NVFP4 artifact id;
  llama.cpp 8080 + the GGUF basename) are the schema defaults, so a fresh
  install pre-fills the whole form and only the fields that differ from the
  defaults need typing. `includeUsage` (default `true`) and `defaultEffort`
  (default `medium`) are deliberately *not* tab controls — they stay in the
  schema/config layer (patch row / environment) and are off by design on a
  dedicated local line.
- **Persistence** is the settings document (`settings.yaml`, hot-reloaded);
  the write path carries the namespace revision, and a stale write surfaces as
  a conflict (re-read), never a silent overwrite.
- **Effect is live, no restart**: the adapter reads the resolved value per
  request and the compaction backend per summarize call, so a saved change
  applies on the next wire call. (A *new chat session* is still required for
  the model catalog fields — `contextWindow` / `maxTokens` / `displayName`
  resolve at session start.)
- **Precedence** for the provider config: settings tab (user layer) → patch
  row / environment → built-in defaults. Without the settings provider
  (headless profiles) the row/environment/default chain from the table above
  still governs, and the trim knobs fall back to the environment variables.
- **Registration is a declared injection, not a store read**: the apply body
  uses `ctx.inject(['settings'], …)` (and `ctx.inject(['attachments'], …)`)
  instead of `ctx.get(…)`. A store read at apply time races the boot order —
  when this plugin's apply ran before the settings provider registered its
  service, the section silently never installed and the settings surface had
  no namespace to write (the llm-pi-ai / tool-fs / agent-loop precedent is the
  declared-injection form; absent optional services keep the child fiber
  pending rather than failing it).

## Wire map

Both dialects speak OpenAI-compatible `/v1/chat/completions` with:

- `max_tokens` (not `max_completion_tokens`), standard `tools` array, `stop`.
- assistant reasoning round-trip via the standard `reasoning_content` field
  (the #1198 hardening: signature-less thinking blocks are not silently
  dropped).
- `finish_reason: length` → harness `max-tokens` (a budget or output
  truncation is not presented as a complete answer).
- usage: `completion_tokens_details.reasoning_tokens` → per-turn reasoning
  tokens in the GUI, when the server reports it (the llama.cpp
  reasoning-budget build does; NInfer 0.5.0 reports it with
  `stream_options.include_usage` — verified 2026-09; the field is optional
  everywhere).
- user image blocks → `image_url` data URLs through the attachment seam;
  an unreadable image degrades to a `[image: name w×h]` text placeholder so
  one missing store entry never fails the request.
- token-meter image pricing (`imageRequestPricing`, synchronous, no I/O):
  the NInfer line prices with its exact patch formula `(W/32)×(H/32)+2`
  visual tokens; the llama.cpp line is clamped server-side into its
  `--image-min-tokens`/`--image-max-tokens` window, so every image prices at
  the clamp maximum (1536) — the conservative bound. The adapter supplies
  the method because the rc.2 `LlmAdapter` base predates the seam and the
  newer token meter resolves it unguarded.

## Develop

```sh
pnpm install
pnpm test              # node --test (host + client + built artifact)
pnpm run build:client  # re-build lib/client.js after editing src/client.js
```

Raw ESM JavaScript with JSDoc for the host half (the dsh-llamacpp shipping
pattern). The browser half (`src/client.js`) is `React.createElement` source,
built by `scripts/build-client.mjs` (esbuild, `react` external) into the DSH
client-module format — a self-registering script the web loader executes as a
classic script — and shipped as the committed `lib/client.js`. Rebuild and
commit after any `src/client.js` change. Peer pins: `@deepseek-ai/cordis
^4.0.1`, `@deepseek-ai/dsh-llm ^0.1.1-rc.2` (verified against the npm
0.1.1-rc.2 line; developed and machine-verified on the 0.1.2-alpha.3 source
tree), plus `@deepseek-ai/schemastery ^3.18.1` and `react ^18.2.0` for the
settings section.

## Known Limitations and Deferred Work

- **Flash-Next is config-compatible, not artifact-verified.** Same wire and
  dialect logic; no NInfer Flash-Next artifact exists yet (0.5.0 ships 27B
  NVFP4 only), so Flash-Next runs on the `llamacpp` dialect (Unsloth
  `qwen4exp` branch) with its own `contextWindow`/budget values.
- **rc.2 summarizer behavior.** The backend trims the prefill itself and
  delegates the one-shot call to the stock engine path; if the installed
  compaction-basic predates the stock `reasoningEffort: off` summarizer,
  compaction thinking-off depends on the engine's call, not this plugin.
  Alpha.3 and later send it unconditionally.
- **The preset seam is a Web-surface feature.** Headless profiles do not
  mount the `agent-presets` row, so their sessions are bare agents and the
  generated preset's compaction backend does not apply there; the provider
  route works in both surfaces. Until the upstream opens a preset/settings
  seam for headless, headless users keep the compaction change on the core
  patch chain.
- **Default preset.** The generated preset is selected per session in the
  GUI, or made the default with the user setting
  `agent-presets: { default: qwen38-qol }` in `settings.yaml`.

---

# 中文

给**本地跑 Qwen3.8** 的人用的 DSH（DeepSeek Harness）QoL 插件——
**Qwen3.8-27B** 跑在 llama.cpp `llama-server` 或 NInfer（[Neroued/ninfer](https://github.com/Neroued/ninfer)：
**ninfer 0.5.0** 原版发布（Docker 镜像）与 **ninfer-windows 0.5.0**
（原生 Windows build）；两者都提供同一套 OpenAI 兼容 `/v1` API，一份插件
配置通吃），以及配置层面的 **Qwen3.8-Flash-Next**（同一 OpenAI 兼容 wire，
同一方言逻辑）。

它给原版 DSH（无核心补丁、无 pi-ai 补丁文件）补上本地 Qwen 线需要的
两样东西：

1. **逐请求 thinking 预算。** 每个请求携带所选 reasoning effort 及其
   thinking token 硬帽：`llamacpp` 方言发 `chat_template_kwargs.reasoning_effort`
   + 顶层 `reasoning_budget_tokens`（llama.cpp 的逐请求预算，覆盖任何
   `--reasoning-budget` CLI 参数）；`ninfer` 方言发顶层 `reasoning_effort`
   （NInfer 0.5.0 的 effort 白名单；预算字段照发但服务端用
   `--default-thinking-budget` 帽住 thinking）。`off` 发
   `chat_template_kwargs.enable_thinking: false`——这个 llama.cpp 构建
   实际读取的开关。
2. **不再把输出帽烧在 thinking 上的压缩（compaction）后端。** 覆盖原版
   引擎唯一的 `summarize()` 钩子：摘要 prefill 先裁剪（只留近期
   reasoning、图片剔除、工具结果截断），一次性调用保持 thinking 关闭——
   checkpoint 拿到完整输出帽，而不是被截断的 "incomplete checkpoint"。

一个包，三处注册：

| 注册 | 接缝 | 挂载点 |
|---|---|---|
| `QwenLocalAdapter`（provider 路由 `qwen38`） | `ctx.llm.registerAdapter()` | bundle 补丁（`cordis.patch.yml`），挂在 profile 根 |
| `QwenLocalCompaction`（压缩后端） | `@deepseek-ai/dsh-compaction-basic` 子类 | 生成的**用户 preset** `~/.dsh/.agent-presets/qwen38-qol/agent.cordis.yml`（每会话 agent preset 拥有隔离的压缩组；profile 级补丁够不到） |
| 设置 tab（**Qwen3.8 本地**） | 用户设置命名空间 `qwen38-local-qol` + 浏览器 `settings.section` 槽位 | settings provider 的 `installSection`（宿主侧）与插件的 `dsh.client` manifest（浏览器侧，`./client` 导出） |

## 安装

```sh
dsh plugin add github:Yunado/dsh-qwen38-local-qol
# 从已安装的 standard preset 生成用户 preset（重跑会留日期备份）：
node_modules/dsh-qwen38-local-qol/src/setup.js --src <已安装的 @deepseek-ai/dsh-agent-presets 的 presets/standard/agent.cordis.yml 路径>
```

然后在 GUI 里选择 **`qwen38-qol`** agent preset（每会话）。

`dsh --profile <name> --patch <plugin>/cordis.patch.yml --dump-config`
可在不启动的情况下查看组合后的 provider 行。

## 配置

provider 行配置（来自 bundle 补丁或 overlay；按 id 定向的补丁替换整个
config 对象，所以环境回退只作用于补丁没写的字段）：

| 字段 | 环境回退 | 默认值 | 含义 |
|---|---|---|---|
| `baseURL` | `DSH_QWEN38_BASE_URL` | `http://127.0.0.1:8082/v1` | 服务器地址（含 `/v1`） |
| `model` | `DSH_QWEN38_MODEL` | `qwen3.8-27b-nvfp4-uncensored` | 请求未带 model 时发送的 id（NInfer 0.5.0 工件 id——Docker 与 Windows build 相同；可用 `GET /v1/models` 对运行中的服务器核实；llama.cpp 线用自己的 id——在那边设此字段或环境变量） |
| `displayName` | `DSH_QWEN38_DISPLAY_NAME` | model id | GUI 模型选择器的可读名（wire id 是工件别名） |
| `apiKey` | `DSH_QWEN38_API_KEY` | — | 服务器 `--api-key`（如设置） |
| `dialect` | `DSH_QWEN38_DIALECT` | `ninfer` | `ninfer` 或 `llamacpp`（thinking wire 方言） |
| `contextWindow` | `DSH_QWEN38_CONTEXT_WINDOW` | `229376` | 声明的上下文容量（压力压缩需要它） |
| `maxTokens` | `DSH_QWEN38_MAX_TOKENS` | `24576` | 声明的每请求输出帽 |
| `thinkingBudgets` | — | `{ low: 4096, medium: 8192, xhigh: 16384 }` | 每档 effort 的 thinking 硬帽；声明的 effort 词汇 = `off` + 这些键（NInfer 线：发送但被忽略——实际帽 = `defaultThinkingBudget` / 服务端参数） |
| `defaultThinkingBudget` | — | `16384` | NInfer 线的实际 thinking 帽：服务端 `--default-thinking-budget` 参数值，全部 effort 共用一个值（NInfer 端点无逐请求预算字段）。由设置 tab 记录——与服务器启动参数保持同步 |
| `defaultEffort` | `DSH_QWEN38_DEFAULT_EFFORT` | `medium` | 注入未带 effort 的请求；必须是 `off` 或 `thinkingBudgets` 键。声明它（任意值）会抑制核心选择器的 "Default" 行——在这条线上它与 `off` 冗余 |
| `thinkingLevelMap` | — | 恒等 | effort id → wire effort 名 |
| `includeUsage` | — | `true` | 请求 `stream_options.include_usage`；上下文仪表与逐轮 reasoning token 显示读取服务端报告的 usage（双方言已验证遵守） |
| `provider` | — | `["qwen38"]` | 要注册的 provider 路由 |

压缩裁剪旋钮（仅环境变量，让 preset 行不携带原版 config schema 不认识的键）：

| 环境变量 | 默认值 | 含义 |
|---|---|---|
| `DSH_QWEN38_SUMMARIZE_IMAGES` | `strip` | `strip` 把图片块降为文本占位符——**vision mmproj offload 到第二设备时优选**（常见本地配置，如 llama.cpp `--mmproj-device <iGPU>`）：摘要器不再在离卡设备上重编码图片。`keep` 保留，checkpoint 能描述像素（每次压缩都重编码——更慢 + 视觉 token 开销） |
| `DSH_QWEN38_SUMMARIZE_KEEP_TURNS` | `5` | 区域尾部保留 reasoning 的 assistant 轮数 |
| `DSH_QWEN38_SUMMARIZE_TOOL_CHARS` | `2000` | 单条工具结果字符帽；`0` 禁用 |

生成的 preset 把后端行的 `maxTokens` 钉在 `16384`（原版 8192 默认帽是
此前 thinking 吃满输出帽的元凶）。

## 设置 tab

在带 settings provider 的 profile（web 面）上，插件注册用户设置命名空间
`qwen38-local-qol`，并在设置弹窗里注册 **Qwen3.8 本地** 页。tab 暴露人
真正会调的 provider 配置：服务器线选择器（llama.cpp / NInfer，即
`dialect` 字段——标签不带端口，因为端口是用户选的）、**按方言**的连接字段
（`baseURL`、`model`、`displayName`）、`contextWindow`、`maxTokens`、
每档 `thinkingBudgets`（NInfer 线置灰）+ 单个 `defaultThinkingBudget`
（仅 NInfer 线显示）、压缩裁剪旋钮（`summarize.images` /
`summarize.keepTurns` / `summarize.toolChars`）——外加版本号指示器与并发
编辑冲突处理。

- **按方言的线记忆**：section 持久化 `lines` 块（`lines.ninfer` /
  `lines.llamacpp`），每条线记住自己的连接（`baseURL` / `model` /
  `displayName`）**和**窗口数字（`contextWindow` / `maxTokens` /
  `thinkingBudgets`）。上下文窗口是线（其服务器的 `-c`，受该线 VRAM 与
  量化约束）的属性，不是模型的属性——同模型的两条线可以合理地不同窗口，
  共享窗口会把较小那线的压缩阈值算错。顶层字段保持 adapter 权威（tab 与
  活跃线同步写），所以宿主侧无需线感知；`lines` 出现前保存的 section 透明
  迁移。tab 里切线 = 两条记忆互换；切回 = 恢复该线原值。压缩裁剪旋钮
  （`summarize`）保持共享：它描述模型行为，不是线的属性。
- **随方言的 thinking 预算字段**：NInfer 线把按 effort 的数字置灰（NInfer
  没有逐请求 thinking 预算——ninfer 0.5.0 / ninfer-windows 0.5.0；数值照发
  但被忽略），另有一个**默认 thinking 预算**字段记录服务端
  `--default-thinking-budget` 参数值（全部 effort 共用一个值）。llama.cpp
  线按 effort 的字段保持可用（逐请求生效）。
- **填一次默认值**：所有窗口数字（每线 229376 / 24576 /
  4096-8192-16384）、裁剪旋钮（strip / 5 / 2000）、每条线的生产连接
  （NInfer 8082 + 27B NVFP4 工件 id；llama.cpp 8080 + GGUF 基名）都是
  schema 默认值——新安装整表预填，只需填与默认不同的字段。`includeUsage`
  （默认 `true`）与 `defaultEffort`（默认 `medium`）刻意**不是** tab
  控件——留在 schema/config 层（补丁行/环境），在专用本地线上按设计
  关闭。
- **持久化** = 设置文档（`settings.yaml`，热加载）；写路径携带命名空间
  版本号，过期写入表现为冲突（重读），绝不静默覆盖。
- **生效即时、免重启**：adapter 每请求读解析值，压缩后端每次 summarize
  读——保存的改动在下一次 wire 调用生效。（*新的聊天会话*仍需要于模型
  目录字段——`contextWindow` / `maxTokens` / `displayName` 在会话开始时
  解析。）
- **优先级**：设置 tab（用户层）→ 补丁行/环境 → 内置默认值。无 settings
  provider（headless profile）时，上表的行/环境/默认链仍生效，裁剪旋钮
  回退到环境变量。
- **注册是声明式注入，不是 store 读取**：apply 体用
  `ctx.inject(['settings'], …)`（和 `ctx.inject(['attachments'], …)`）
  而不是 `ctx.get(…)`。apply 时的 store 读取与启动顺序竞争——本插件 apply
  先于 settings provider 注册服务运行时，section 会静默装不上
  （llm-pi-ai / tool-fs / agent-loop 先例是声明注入形式；缺失的可选服务
  让子 fiber 保持 pending 而非失败）。

## Wire 对照

双方言都讲 OpenAI 兼容 `/v1/chat/completions`：

- `max_tokens`（不是 `max_completion_tokens`）、标准 `tools` 数组、`stop`。
- assistant reasoning 往返走标准 `reasoning_content` 字段（#1198 加固：
  无签名 thinking 块不再被静默丢弃）。
- `finish_reason: length` → harness `max-tokens`（预算或输出截断不表现为
  完整回答）。
- usage：`completion_tokens_details.reasoning_tokens` → GUI 逐轮
  reasoning tokens（服务端报告时；llama.cpp reasoning-budget 构建报告；
  NInfer 0.5.0 在 `stream_options.include_usage` 下报告——2026-09 验证；
  该字段处处可选）。
- 用户图片块 → 经 attachment 接缝的 `image_url` data URL；读不到的图降为
  `[image: name w×h]` 文本占位——单个 store 条目缺失从不搞挂请求。
- token 仪表图片计价（`imageRequestPricing`，同步、无 I/O）：NInfer 线用
  其精确 patch 公式 `(W/32)×(H/32)+2` 视觉 token；llama.cpp 线被服务端
  钳在 `--image-min-tokens`/`--image-max-tokens` 窗口内，所以每张图都按
  钳位上限（1536）计价——保守上界。adapter 自带该方法，因为 rc.2
  `LlmAdapter` 基类早于该接缝、而新版 token 仪表无守卫地解析它。

## 开发

```sh
pnpm install
pnpm test              # node --test（host + client + 构建产物）
pnpm run build:client  # 改完 src/client.js 后重建 lib/client.js
```

宿主半边是带 JSDoc 的裸 ESM JavaScript（dsh-llamacpp 的出货模式）。
浏览器半边（`src/client.js`）是 `React.createElement` 源码，由
`scripts/build-client.mjs`（esbuild，`react` external）构建为 DSH client
模块格式——web loader 作为经典脚本执行的自注册脚本——以已提交的
`lib/client.js` 出货。`src/client.js` 任何改动后重建并提交。Peer 钉版：
`@deepseek-ai/cordis ^4.0.1`、`@deepseek-ai/dsh-llm ^0.1.1-rc.2`（对 npm
0.1.1-rc.2 线验证；在 0.1.2-alpha.3 源码树上开发与机器验证），设置
section 另有 `@deepseek-ai/schemastery ^3.18.1` 与 `react ^18.2.0`。

## 已知限制与暂缓工作

- **Flash-Next 是配置兼容，未工件验证。** 同一 wire 与方言逻辑；NInfer
  Flash-Next 工件尚不存在（0.5.0 只出 27B NVFP4），所以 Flash-Next 跑在
  `llamacpp` 方言（Unsloth `qwen4exp` 分支），用自己的
  `contextWindow`/预算值。
- **rc.2 摘要器行为。** 后端自己裁 prefill，一次性调用委托给原版引擎路径；
  若已安装的 compaction-basic 早于原版 `reasoningEffort: off` 摘要器，
  压缩 thinking-off 取决于引擎那次调用而非本插件。Alpha.3 起无条件发送。
- **preset 接缝是 web 面功能。** headless profile 不挂 `agent-presets`
  行，其会话是裸 agent，生成的 preset 压缩后端在那里不生效；provider 路由
  两面都工作。上游为 headless 打开 preset/settings 接缝之前，headless
  用户的压缩改动保留在核心补丁链上。
- **默认 preset。** 生成的 preset 在 GUI 里每会话选择，或在 `settings.yaml`
  里用用户设置 `agent-presets: { default: qwen38-qol }` 设为默认。
