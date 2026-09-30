# dsh-qwen38-local-qol

[English](#dsh-qwen38-local-qol) · [中文](#中文)

[![Awesome DSH Plugin](https://awesome-dsh-plugin.com/badge.svg)](https://awesome-dsh-plugin.com/p/Yunado/dsh-qwen38-local-qol/) · [![Listed on dsh-plugin.org](https://dsh-plugin.org/badges/listed.svg)](https://dsh-plugin.org/plugins/yunado/dsh-qwen38-local-qol) · [![dshfind](https://dshfind.com/api/badge/Yunado/dsh-qwen38-local-qol?lang=zh)](https://dshfind.com/zh/plugins/Yunado/dsh-qwen38-local-qol?ref=badge) · [![License: MIT](https://img.shields.io/github/license/Yunado/dsh-qwen38-local-qol)](https://github.com/Yunado/dsh-qwen38-local-qol/blob/main/LICENSE)

[![dsh.so risk](https://www.dsh.so/badge/dsh-qwen38-local-qol.svg)](https://www.dsh.so/artifact/dsh-qwen38-local-qol/) · [![dsh.so install · dsh 0.1.6-alpha.2](https://www.dsh.so/badge/install/dsh-qwen38-local-qol@0.1.6-alpha.2.svg)](https://www.dsh.so/artifact/dsh-qwen38-local-qol/) · [![dsh.so install · dsh 0.1.5-rc.2](https://www.dsh.so/badge/install/dsh-qwen38-local-qol@0.1.5-rc.2.svg)](https://www.dsh.so/artifact/dsh-qwen38-local-qol/)

A QoL plugin for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (DSH) for running **Qwen3.8 locally**, with no core patches and no pi-ai patchfile.

- **Model support**: Qwen3.8-27B · Qwen3.8-Flash-Next
- **Serving engines**: llama.cpp `llama-server` · NInfer · TabbyAPI (ExLlamaV3) · oMLX (Apple Silicon MLX)
- **Note**: the llama.cpp lane is the standard OpenAI-compatible `/v1` API - any server speaking it is expected to work there (Strata, Unsloth Desktop, LM Studio).

## Install

```sh
dsh plugin --profile web add github:Yunado/dsh-qwen38-local-qol#v0.3.0
```

Recommended: pin a release tag (newest tag listed on [Releases](https://github.com/Yunado/dsh-qwen38-local-qol/releases)); drop the `#tag` fragment to track `main`, the bleeding edge.

Restart `dsh web`: the plugin's bundle patch **declares** the **`qwen38`** agent preset (full roster with the qol compaction backend) and points the profile default at it when no default is configured - nothing is generated on disk at boot. New sessions use it automatically; existing sessions keep the preset they were created with.

You can also pin a specific release: add a tag to the spec (`#v0.3.0` or any past release). See [Releases](https://github.com/Yunado/dsh-qwen38-local-qol/releases) for what each tag pins and how to upgrade from it. Pinning a tag is the recommended setup - `main` is the bleeding edge (unreleased fixes and experiments land there first); move off a tag only when you actually want the newest changes.

## DSH compatibility

| DSH host | Plugin | Status |
|---|---|---|
| 0.2.0-rc.2 | `#v0.3.0` | tested (production) |
| 0.1.7-alpha.1 - 0.2.0-rc.1 | `#v0.3.0` | should work - same seam batch, not exercised |
| 0.1.6-alpha.2 and older | `#v0.2.0` | supported line |

`main` targets the rc.2 seam batch; stay on `#v0.2.0` with older hosts.

Upgrading from v0.2.0 (host first, then plugin):

```sh
# 1) update the DSH host to 0.2.0-rc.2 or newer (normal host update).
# 2) re-pin the plugin (profile dir; Windows: %USERPROFILE%\.dsh\profiles\web):
cd ~/.dsh/profiles/web
npm pkg set 'dependencies.dsh-qwen38-local-qol=github:Yunado/dsh-qwen38-local-qol#v0.3.0'
pnpm install
rm -rf ~/.dsh/.agent-presets/qwen38    # optional: old boot-generated preset (superseded, inert)
# 3) restart dsh web. Sessions already on qwen38 keep working (same id, new
#    declaration). For new sessions: if a different preset is your default,
#    pick Qwen38 on the Agent presets page. Then open Settings -> Qwen3.8
#    Local and fill the line config once (the old settings.yaml section is
#    not read by the new storage).
```

![the qwen38 preset declared by the bundle patch, on the Agent presets page](<docs/preset-en.png>)

## What it supports

- **Per-request thinking budgets.** The llama.cpp line sends the selected per-effort budget on every request (`reasoning_effort` + `reasoning_budget_tokens`, overrides the server's `--reasoning-budget`); the NInfer engine reads its single thinking budget from the server startup flag (`--default-thinking-budget`); the settings tab shows that as a note on the NInfer line (no input), while `defaultThinkingBudget` stays valid as a headless/env config field; the TabbyAPI line accepts both natively; the oMLX line (Apple Silicon MLX) accepts native top-level `thinking_budget` and `chat_template_kwargs.enable_thinking`, so per-effort budgets ride every request.
- **A compaction backend.** The summarizer's prefill is trimmed (recent reasoning only, images downgraded to text placeholders, tool results capped), and compaction calls run thinking-off at the line's full output cap, so checkpoints stop getting truncated at the token cap. The trigger point is a live slider in the settings tab (default 80% of the window).
- **Vision in tool results.** Image blocks nested in tool results (for example `read_image` output) ride the wire instead of being dropped: a resolved image travels inside a multimodal tool message (a content array with an `image_url` entry); an unreadable one degrades to the same text placeholder as the user side, so the model sees that an image was there but its pixels were not.
- **A settings tab** that configures all lines, live.

## The settings tab

DSH settings → **Qwen3.8 Local**:

![the Qwen3.8 Local settings tab](<docs/tab-en.png>)

Per-line memory (connection, window numbers, budgets, trim knobs). The status dot is green when `qwen38` is the default preset, amber when a different preset is the default, gray when the preset is missing. Changes apply live and persist to the profile's plugin config (Cordis patch; hot volatile commits, no restart).

## What can be tuned

The settings tab is the primary entry; headless profiles and patch/env accept the same fields (an id-scoped patch replaces the whole config; env covers what the patch does not set):

| Area | Fields (env vars) | Defaults |
|---|---|---|
| Server | `baseURL`, `model`, `displayName`, `apiKey` (`DSH_QWEN38_BASE_URL` / `_MODEL` / `_DISPLAY_NAME` / `_API_KEY`) | `http://localhost:8080/v1` (llama) / `8082` (ninfer) / `8083` (tabbyapi) / `8000` (omlx), model alias, same as `model`, none |
| Dialect | `dialect` (`DSH_QWEN38_DIALECT`) | `llamacpp` (options: `ninfer`, `tabbyapi`, `omlx`) |
| Window | `contextWindow`, `maxTokens` (`DSH_QWEN38_CONTEXT_WINDOW` / `_MAX_TOKENS`) | `131072`, `16384` (starter defaults every local server can host; raise them to your server's real context, and keep the tab at or below what the server was started with) |
| Thinking | `thinkingBudgets` (llamacpp + tabbyapi + omlx, per effort), `defaultThinkingBudget` (the declared server thinking ceiling; the tab shows it on the ninfer line only — enter the server's `--default-thinking-budget` value there, the plugin cannot read the startup flag), `defaultEffort` (`DSH_QWEN38_DEFAULT_EFFORT`) | `{ low: 2048, medium: 4096, xhigh: 8192 }`, `8192`, `medium` |
| Prefill trim | `DSH_QWEN38_SUMMARIZE_IMAGES`, `DSH_QWEN38_SUMMARIZE_KEEP_TURNS`, `DSH_QWEN38_SUMMARIZE_TOOL_CHARS` (env only) | `strip`, `5`, `2000` |
| Compaction trigger | `compactThresholdPct` (the tab slider) | `80` (fires at exactly that percent of the window; the slider syncs the output cap to keep the point reachable) |

### Settings & Fields Explained

#### 1. Server Connection & Dialect
- **Dialect (`dialect`)**: The backend engine running your local model:
  - `llamacpp`: Standard `llama.cpp` server (`llama-server`). Sets thinking budget dynamically per request.
  - `omlx`: Apple Silicon MLX inference server. Sends per-request thinking budget via native `thinking_budget`.
  - `tabbyapi`: ExLlamaV3 backend. Fast path for EXL3 quants, accepts per-request budgets natively.
  - `ninfer`: High-performance TensorRT-LLM engine. Thinking budget is configured at server startup.
- **Base URL (`baseURL`)**: The address where your local server is listening (must include `/v1`). Default ports: `8080` for llama.cpp, `8000` for oMLX, `8082` for NInfer, `8083` for TabbyAPI.
- **Model (`model`)**: The model identifier or alias recognized by your server (e.g. `Qwen3.8-27B-MLX-8bit` or `qwen3.8-27b`).
- **Display Name (`displayName`)**: Optional label shown in the Harness UI model picker (e.g. "Qwen 3.8 Local"). If blank, the model ID is shown.
- **API Key (`apiKey`)**: Optional bearer token if your server requires authentication. Leave blank for unauthenticated local servers.

#### 2. Context Window & Token Limits
- **Context Window (`contextWindow`)**: Total token capacity the model can handle (prompt + response). Harness uses this to know when a session is filling up and automatically triggers compaction to prevent overflow.
- **Max Output Tokens (`maxTokens`)**: Maximum number of tokens the model can generate in a single response.

#### 3. Thinking & Reasoning Budgets
- **Thinking Budgets (`thinkingBudgets`)**: Token limit for the model's internal reasoning (`<think>...</think>`) before generating an answer:
  - **Low**: Quick reasoning for simpler questions (default: 4,096 tokens).
  - **Medium**: Balanced reasoning for general coding and tasks (default: 8,192 tokens).
  - **Extra High**: Deep step-by-step thinking for complex bugs or architecture (default: 16,384 tokens).
- **Default Effort (`defaultEffort`)**: The default thinking level used (`off`, `low`, `medium`, or `xhigh`). Selecting `off` skips thinking entirely for faster, direct answers.
- **Default Thinking Budget (`defaultThinkingBudget`)**: Fallback token budget for engines that set thinking capacity globally at startup rather than per request (such as NInfer).

#### 4. History Compaction & Trimming
When conversations approach the context window limit, Harness compresses older history into summaries:
- **Compaction trigger point (`compactThresholdPct`)**: where automatic compaction fires, at exactly this percent of the context window (slider default 80). The tab slider (50..90 band) is hot, landing on the next session step without a restart. The slider also syncs the output cap in both directions to the largest value that keeps the point reachable under the wall guard (a quarter of the cap): dragging the slider rewrites the cap so every percent is an exact trigger point (the token point shows beside the label). If a point would need the cap below what your thinking budgets require, the cap parks at that floor, a red checker names the cap the point needs, and saving stays refused until you lower a thinking budget by hand. Every thinking budget (low/medium/xhigh and the default) must stay strictly below the output cap; the tab refuses the save otherwise. Current usage lives in the chat page's top meter.
- **Summarize Images (`summarize.images`)**:
  - `strip` (recommended): Replaces older images with brief text placeholders to save significant context space.
  - `keep`: Preserves past images in memory.
- **Keep Recent Reasoning (`summarize.keepTurns`)**: How many recent assistant turns retain their full thought logs (`<think>`). Older turns have their thoughts trimmed because previous reasoning is rarely needed once an action has succeeded.
- **Cap Tool Output (`summarize.toolChars`)**: Maximum character length kept for bulky command outputs or file reads in compacted history (default: 2,000 characters). Prevents giant terminal logs from flooding the context window.

#### 5. Per-Line Memory
The settings tab keeps independent settings for each dialect (`llamacpp`, `omlx`, `ninfer`, `tabbyapi`). Switching between server buttons automatically restores each server's specific port, model alias, and context size without re-entering them.

## Limitations

- **Vision token pricing on TabbyAPI / oMLX is not pinned**: token meters report image capacity as unknown on these lines until the backend image-processor formulas are calibrated (the request itself works; only the pre-flight capacity projection is affected).
- **Multimodal tool messages are a newer wire form**: tool messages carrying resolved images are sent as a content array with `image_url` entries; each line's server must accept that form. A rejecting line answers with an HTTP error whose body the adapter surfaces verbatim (never a silent drop).
- **Vision budget rejections self-heal**: an NInfer 400 `media_budget_exceeded` ("vision raw patches exceed processor budget") classifies as `CONTEXT_WINDOW_EXCEEDED`, so the harness's overflow recovery compacts history below the normal threshold and retries the step; only repeated budget failures (e.g. one image alone over the per-image cap) surface as an error.
- **The preset seam is a web-surface feature**: headless profiles do not mount `agent-presets` rows; the provider route (thinking budgets) works on both surfaces.
- **Summarizer internals depend on the engine version**: the wire rules (thinking off, full output cap) hold for every engine version; engine internals are outside the plugin's control.

## Update

```sh
dsh plugin --profile web update dsh-qwen38-local-qol
```

`github:` dependencies resolve to an exact commit. If the profile lockfile still pins the commit first installed, edit the spec (a newer `#tag`, or drop the fragment to track main) and re-run `pnpm install` in the profile directory. Updates never touch the declared preset or the settings section.

## Uninstall

1. `dsh plugin --profile web remove dsh-qwen38-local-qol`
2. Restart `dsh web` - the qwen38 preset declaration and its default ride the plugin's bundle patch, so both disappear with it.

Session history, transcripts, model lines and engines are not state the plugin owns.

## Develop

```sh
pnpm install
pnpm test
pnpm run build:client   # rebuild lib/client.js after touching src/client*
```

Host half = plain ESM JavaScript with JSDoc; the browser half is built by `scripts/build-client.mjs` and shipped as the committed `lib/client.js`. Design details: [DESIGN.md](DESIGN.md).

## License

[MIT](LICENSE)

## 中文

给**本地跑 Qwen3.8** 的人用的 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)（DSH）QoL 插件，零核心补丁、零 pi-ai 补丁文件。

- **模型支持**：Qwen3.8-27B · Qwen3.8-Flash-Next
- **推理引擎**：llama.cpp `llama-server` · NInfer · TabbyAPI（ExLlamaV3）· oMLX（Apple Silicon MLX）
- **注**：llama.cpp 线即标准 OpenAI 兼容 `/v1` API，任何说这套协议的服务器预期都能走这条线（Strata、Unsloth Desktop、LM Studio）。

## 安装

```sh
dsh plugin --profile web add github:Yunado/dsh-qwen38-local-qol#v0.3.0
```

推荐钉 release tag（最新 tag 见 [Releases](https://github.com/Yunado/dsh-qwen38-local-qol/releases)）；去掉 `#tag` 即跟随前沿线 `main`。

重启 `dsh web`：插件的 bundle patch **声明**了 **`qwen38`** agent preset（完整 roster + qol 压缩后端），未配置默认时把 profile 默认指向它 —— boot 期间不写盘生成任何东西。新会话自动使用；已有会话保留创建时的 preset。

也可以钉住某个具体 release：在 spec 里加 tag（`#v0.3.0` 或任意历史 tag）。每个 tag 钉住什么、之后怎么升，见 [Releases](https://github.com/Yunado/dsh-qwen38-local-qol/releases)。推荐钉 tag —— `main` 是前沿线（未发布的修复和实验先进 main），确有需求再离开 tag。

## DSH 兼容性

| DSH 宿主 | 插件版本 | 状态 |
|---|---|---|
| 0.2.0-rc.2 | `#v0.3.0` | 实测通过（生产） |
| 0.1.7-alpha.1 - 0.2.0-rc.1 | `#v0.3.0` | 应可用 - 同一批缝，未实测 |
| 0.1.6-alpha.2 及更早 | `#v0.2.0` | 支持线 |

`main` 已面向 rc.2 缝批次；老宿主请钉 `#v0.2.0`。

从 v0.2.0 升级（先升宿主，再升插件）：

```sh
# 1) 先把 DSH 宿主升到 0.2.0-rc.2 或更新（正常宿主更新）。
# 2) 重钉插件（profile 目录；Windows：%USERPROFILE%\.dsh\profiles\web）：
cd ~/.dsh/profiles/web
npm pkg set 'dependencies.dsh-qwen38-local-qol=github:Yunado/dsh-qwen38-local-qol#v0.3.0'
pnpm install
rm -rf ~/.dsh/.agent-presets/qwen38    # 可选：旧 boot 生成的 preset（已被取代，惰性）
# 3) 重启 dsh web。已在用 qwen38 的会话无缝继续（同 id、新声明接管）。
#    新会话：若你的默认是别的 preset，去 Agent 预设页把 Qwen38 设为默认。
#    然后打开 设置 -> Qwen3.8 本地，把线的配置填一遍（新的 profile 配置
#    存储不读旧的 settings.yaml 节）。
```

![bundle patch 声明的 qwen38 preset（Agent 预设页）](<docs/preset-cn.png>)

## 功能特性

- **逐请求 thinking 预算。** llama.cpp 线每请求发送所选 effort 的预算（`reasoning_effort` + `reasoning_budget_tokens`，覆盖服务端 `--reasoning-budget`）；NInfer 引擎的 thinking 预算由服务端启动参数（`--default-thinking-budget`）决定；设置 tab 在 NInfer 线只显示说明（无输入），`defaultThinkingBudget` 字段保留为 headless/env 配置项；TabbyAPI 线两者都原生接受；oMLX 线（Apple Silicon MLX）原生接受顶层 `thinking_budget` 与 `chat_template_kwargs.enable_thinking`，逐请求按档发送。
- **压缩（compaction）后端。** 摘要 prefill 先裁剪（只留近 N 轮 reasoning、图片降为文本占位符、工具结果按字数帽截断），且压缩调用强制 thinking off + 该线完整输出帽，checkpoint 不再被 token 帽截断。触发点是设置页的实时滑杆（默认窗口的 80%）。
- **工具结果里的图片不再丢弃。** 嵌套在 tool-result 内的 image block（如 `read_image` 的结果）现在会上线：attachment 能解出 data URL 时，图以多模态 tool 消息（content 数组 + `image_url` 条目）发送；读不出来时用与用户侧相同的文本占位符，模型知道"这里有张图但看不见像素"。
- **设置 tab**：图形化配置四条服务线，即时生效。

## 设置 tab

DSH 设置 → **Qwen3.8 本地**：

![Qwen3.8 本地设置页](<docs/tab-cn.png>)

按线记忆（连接、窗口数字、预算、裁剪旋钮）。状态圆点：绿 = `qwen38` 是默认 preset，黄 = 默认是别的 preset，灰 = preset 缺失。改动即时生效并持久化到 profile 的插件配置（Cordis patch，volatile 热提交，无需重启）。

## 可调项

设置 tab 是主入口；headless profile 或补丁/环境接受同样字段（按 id 定向的补丁替换整个 config，环境回退只覆盖补丁没写的字段）：

| 区域 | 字段（环境变量） | 默认 |
|---|---|---|
| 服务器 | `baseURL`、`model`、`displayName`、`apiKey`（`DSH_QWEN38_BASE_URL` / `_MODEL` / `_DISPLAY_NAME` / `_API_KEY`） | `http://localhost:8080/v1`（llama）/ `8082`（ninfer）/ `8083`（tabbyapi）/ `8000`（omlx）、模型别名、同 `model`、无 |
| 方言 | `dialect`（`DSH_QWEN38_DIALECT`） | `llamacpp`（可选：`ninfer`、`tabbyapi`、`omlx`） |
| 窗口 | `contextWindow`、`maxTokens`（`DSH_QWEN38_CONTEXT_WINDOW` / `_MAX_TOKENS`） | `131072`、`16384`（新装起步值，任何本地服务都扛得住；请按服务的真实上下文调大，且设置页不得超过服务启动时设定的上限） |
| Thinking | `thinkingBudgets`（llamacpp + tabbyapi + omlx，按 effort）、`defaultThinkingBudget`（申报的服务端 thinking 上限；设置页仅在 ninfer 线显示这一格——把服务启动参数 `--default-thinking-budget` 的值填在这里，插件读不到启动参数）、`defaultEffort`（`DSH_QWEN38_DEFAULT_EFFORT`） | `{ low: 2048, medium: 4096, xhigh: 8192 }`、`8192`、`medium` |
| Prefill 裁剪 | `DSH_QWEN38_SUMMARIZE_IMAGES`、`DSH_QWEN38_SUMMARIZE_KEEP_TURNS`、`DSH_QWEN38_SUMMARIZE_TOOL_CHARS`（仅环境变量） | `strip`、`5`、`2000` |
| 压缩触发 | `compactThresholdPct`（tab 滑杆） | `80`（触发点 = 该百分比 × 窗口；滑杆双向联动输出上限，保证该点精确落地） |

### 设置项与字段说明

#### 1. 服务器连接与方言
- **方言（`dialect`）**：运行模型的本地推理后端类型：
  - `llamacpp`：标准 `llama.cpp` 服务（`llama-server`），每请求通过 `reasoning_budget_tokens` 动态控制思考预算。
  - `omlx`：Apple Silicon 专用的 MLX 推理服务，每请求通过顶层 `thinking_budget` 控制思考预算。
  - `tabbyapi`：ExLlamaV3 推理服务，EXL3 量化的快线，原生支持每请求思考预算。
  - `ninfer`：高性能 TensorRT-LLM 引擎，思考预算在服务端启动参数中指定。
- **服务地址（`baseURL`）**：本地后端服务的 HTTP 地址（需包含 `/v1`）。默认端口：llama.cpp 为 `8080`、oMLX 为 `8000`、NInfer 为 `8082`、TabbyAPI 为 `8083`。
- **模型标识（`model`）**：服务端配置的模型名称或别名（如 `Qwen3.8-27B-MLX-8bit` 或 `qwen3.8-27b`）。
- **显示名称（`displayName`）**：在 Harness UI 界面模型下拉菜单中显示的友好名称（如 “Qwen 3.8 本地”）。留空时直接显示模型标识。
- **API 密钥（`apiKey`）**：若本地服务开启了鉴权，在此填入 API Key。若无需鉴权可留空。

#### 2. 上下文与输出窗口
- **上下文窗口（`contextWindow`）**：模型能容纳的最大总 token 容量（输入 + 输出）。Harness 据此判断会话何时接近上限并自动触发压缩（compaction），防止超窗。
- **最大输出 Token（`maxTokens`）**：单轮回复中模型允许生成的最大 token 数量。

#### 3. Thinking 思考预算
- **思考预算档位（`thinkingBudgets`）**：模型在给出最终答案前在 `<think>` 标签内能思考的最大 token 数量：
  - **Low（低）**：轻度思考，适合简单明确的任务（默认 4,096 tokens）。
  - **Medium（中）**：平衡思考，适合日常编码与问答（默认 8,192 tokens）。
  - **Extra High（超高）**：深度多步推理，适合复杂架构与疑难调试（默认 16,384 tokens）。
- **默认档位（`defaultEffort`）**：默认启用的思考强度（`off`、`low`、`medium`、`xhigh`）。选 `off` 则完全关闭 thinking 模式，回复更快速直接。
- **默认思考预算（`defaultThinkingBudget`）**：针对不支持逐请求切换档位的引擎（如 NInfer）使用的回退预算值。

#### 4. 历史压缩与裁剪（Compaction）
当会话过长接近上下文上限时，Harness 会将较早的历史压缩成摘要：
- **压缩触发点（`compactThresholdPct`）**：自动压缩恰在窗口的该百分比处触发（滑杆默认 80）。设置页滑杆（50–90 区间）改完即生效、无需重启，落在下一个会话步骤；滑杆同时双向联动输出上限——拖动即重写该帽到"保证该点可落地的最大值"（墙护=帽的 1/4），于是每一格都是精确的真实触发点（标签旁显示对应的 token 点）。若某点所需的帽会低于 thinking 预算所需的容量，帽停在该底线、红字 checker 点出该点需要的帽值，保存被拦，直到手动调低某档预算。每档 thinking 预算（低/中/超高）与默认预算必须严格小于输出上限，否则设置页拒绝保存。当前用量看聊天页顶部的上下文计量。
- **图片处理（`summarize.images`）**：
  - `strip`（推荐）：在旧轮次中移除大图并替换为简短占位文本，大幅节省上下文空间。
  - `keep`：在历史中保留原图。
- **保留近期思考（`summarize.keepTurns`）**：压缩时保留最近多少轮助手的完整 `<think>` 思考过程（默认 5 轮）。更早轮次的思考过程会被裁掉（通常只需最终操作结果，无需保留早期心路历程）。
- **工具输出截断（`summarize.toolChars`）**：历史中单次工具输出（如大段终端日志或文件读取）保留的最大字符数（默认 2000 字），防止巨量日志挤占宝贵的上下文。

#### 5. 按线独立记忆
设置 tab 为每种方言（`llamacpp`、`omlx`、`ninfer`、`tabbyapi`）保留独立的配置记忆。切换方言单选框会自动恢复该服务线的地址、模型名与窗口大小，无需反复重新填写。

## 已知限制

- **TabbyAPI / oMLX 线的视觉 token 数未钉**：这些线上 token meter 报图片容量未知（请求本身正常，只影响预检容量投影）。
- **preset 接缝是 web 面功能**：headless profile 不挂 `agent-presets` 行；provider 路由（thinking 预算）两面都工作。
- **摘要器内部行为依赖引擎版本**：wire 层规则（thinking off、完整输出帽）对所有引擎版本生效；引擎内部行为不在本插件控制之内。

## 更新

```sh
dsh plugin --profile web update dsh-qwen38-local-qol
```

`github:` 依赖按精确 commit 解析。若 profile 锁文件仍钉在首次安装时的 commit，改 spec（更新的 `#tag`，或去掉 fragment 跟随 main）后在 profile 目录重跑 `pnpm install`。更新不触碰声明的 preset 与设置节。

## 卸载

1. `dsh plugin --profile web remove dsh-qwen38-local-qol`
2. 重启 `dsh web` —— qwen38 preset 声明与默认都挂在插件的 bundle patch 上，随插件一起消失。

会话历史、transcript、模型线、引擎都不是插件持有的状态。

## 开发

```sh
pnpm install
pnpm test
pnpm run build:client   # 改完 src/client* 后重建 lib/client.js
```

宿主半边 = 带 JSDoc 的裸 ESM JavaScript；浏览器半边由 `scripts/build-client.mjs` 构建并以已提交的 `lib/client.js` 出货。设计细节：[DESIGN.md](DESIGN.md)。

## 许可

[MIT](LICENSE)
