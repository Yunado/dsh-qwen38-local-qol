# dsh-qwen38-local-qol

[English](#dsh-qwen38-local-qol) · [中文](#中文)

[![Awesome DSH Plugin](https://awesome-dsh-plugin.com/badge.svg)](https://awesome-dsh-plugin.com/p/Yunado/dsh-qwen38-local-qol/) · [![Listed on dsh-plugin.org](https://dsh-plugin.org/badges/listed.svg)](https://dsh-plugin.org/plugins/yunado/dsh-qwen38-local-qol) · [![License: MIT](https://img.shields.io/github/license/Yunado/dsh-qwen38-local-qol)](https://github.com/Yunado/dsh-qwen38-local-qol/blob/main/LICENSE)

[![dsh.so risk](https://www.dsh.so/badge/dsh-qwen38-local-qol.svg)](https://www.dsh.so/artifact/dsh-qwen38-local-qol/) · [![dsh.so install · dsh 0.1.6-alpha.2](https://www.dsh.so/badge/install/dsh-qwen38-local-qol@0.1.6-alpha.2.svg)](https://www.dsh.so/artifact/dsh-qwen38-local-qol/) · [![dsh.so install · dsh 0.1.5-rc.2](https://www.dsh.so/badge/install/dsh-qwen38-local-qol@0.1.5-rc.2.svg)](https://www.dsh.so/artifact/dsh-qwen38-local-qol/)

A QoL plugin for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (DSH) for running **Qwen3.8 locally** (llama.cpp `llama-server`, NInfer, TabbyAPI (the ExLlamaV3 backend server), or oMLX (Apple Silicon MLX inference server; all serve the OpenAI-compatible `/v1` API; at the config level also **Qwen3.8-Flash-Next**). No core patches, no pi-ai patchfile.

## Install

```sh
dsh plugin --profile web add github:Yunado/dsh-qwen38-local-qol
```

Restart `dsh web`: at boot the plugin generates the **`qwen38`** user preset from the standard preset's composition, and sets it as the default agent preset when no default is configured. New sessions use it automatically; existing sessions keep the preset they were created with.

### Install a specific version

The bare spec above tracks `main` (an `update` follows it). To pin an exact release instead:

```sh
dsh plugin --profile web add github:Yunado/dsh-qwen38-local-qol#v0.2.0
```

Tags are immutable, so a pinned install never drifts on its own; `update` keeps you on the pinned tag. Change the `#tag` to move. History: [GitHub Releases](https://github.com/Yunado/dsh-qwen38-local-qol/releases).

![the generated qwen38 preset on the Agent presets page](<docs/qwen38 preset-en.png>)

## What it supports

- **Per-request thinking budgets.** The llama.cpp line sends the selected per-effort budget on every request (`reasoning_effort` + `reasoning_budget_tokens`, overrides the server's `--reasoning-budget`); the NInfer engine reads its single thinking budget from the server startup flag (`--default-thinking-budget`); the settings tab shows that as a note on the NInfer line (no input), while `defaultThinkingBudget` stays valid as a headless/env config field; the TabbyAPI line accepts both natively; the oMLX line (Apple Silicon MLX) accepts native top-level `thinking_budget` and `chat_template_kwargs.enable_thinking`, so per-effort budgets ride every request.
- **A compaction backend.** The summarizer's prefill is trimmed (recent reasoning only, images downgraded to text placeholders, tool results capped), and compaction calls run thinking-off at the line's full output cap, so checkpoints stop getting truncated at the token cap.
- **Vision in tool results.** Image blocks nested in tool results (for example `read_image` output) ride the wire instead of being dropped: a resolved image travels inside a multimodal tool message (a content array with an `image_url` entry); an unreadable one degrades to the same text placeholder as the user side, so the model sees that an image was there but its pixels were not.
- **A settings tab** that configures all lines, live.

## The settings tab

DSH settings → **Qwen3.8 Local**:

![server line selector: llama.cpp / NInfer / TabbyAPI / oMLX](<docs/qwen38 server-en.png>)

![the Qwen3.8 Local settings tab](<docs/qwen38 tab-en.png>)

Per-line memory (connection, window numbers, budgets, trim knobs). The status dot is green when `qwen38` is the default preset, amber when a different preset is the default, gray when the preset is missing. Changes apply live and persist to `settings.yaml` (hot-reloaded).

## What can be tuned

The settings tab is the primary entry; headless profiles and patch/env accept the same fields (an id-scoped patch replaces the whole config; env covers what the patch does not set):

| Area | Fields (env vars) | Defaults |
|---|---|---|
| Server | `baseURL`, `model`, `displayName`, `apiKey` (`DSH_QWEN38_BASE_URL` / `_MODEL` / `_DISPLAY_NAME` / `_API_KEY`) | `http://localhost:8080/v1` (llama) / `8082` (ninfer) / `8083` (tabbyapi) / `8000` (omlx), model alias, same as `model`, none |
| Dialect | `dialect` (`DSH_QWEN38_DIALECT`) | `llamacpp` (options: `ninfer`, `tabbyapi`, `omlx`) |
| Window | `contextWindow`, `maxTokens` (`DSH_QWEN38_CONTEXT_WINDOW` / `_MAX_TOKENS`) | `262144`, `52428` (output cap ≈ 20% of the window, headroom for the compaction trigger at 0.8×) |
| Thinking | `thinkingBudgets` (llamacpp + tabbyapi + omlx, per effort), `defaultThinkingBudget` (ninfer, headless/env only; the tab shows the startup flag), `defaultEffort` (`DSH_QWEN38_DEFAULT_EFFORT`) | `{ low: 4096, medium: 8192, xhigh: 16384 }`, `16384`, `medium` |
| Prefill trim | `DSH_QWEN38_SUMMARIZE_IMAGES`, `DSH_QWEN38_SUMMARIZE_KEEP_TURNS`, `DSH_QWEN38_SUMMARIZE_TOOL_CHARS` (env only) | `strip`, `5`, `2000` |

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

`github:` dependencies resolve to an exact commit. If the profile lockfile still pins the commit first installed, remove and re-add the plugin to force re-resolution. Updates never touch the generated preset or the settings section.

## Uninstall

1. `dsh plugin --profile web remove dsh-qwen38-local-qol`
2. Delete the **`qwen38`** preset on the Agent presets page.
3. Drop `agent-presets: { default: qwen38 }` from `~/.dsh/settings.yaml`.
4. Restart DSH.

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

给**本地跑 Qwen3.8** 的人用的 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)（DSH）QoL 插件（llama.cpp `llama-server`、NInfer、TabbyAPI（ExLlamaV3 后端服务器），或 oMLX（Apple Silicon MLX 推理后端）；均提供 OpenAI 兼容 `/v1` API；配置层面兼容 **Qwen3.8-Flash-Next**）。零核心补丁、零 pi-ai 补丁文件。

## 安装

```sh
dsh plugin --profile web add github:Yunado/dsh-qwen38-local-qol
```

重启 `dsh web`：启动时插件从 standard preset 的组成生成 **`qwen38`** 用户 preset，且未配置默认时将其设为默认 agent preset。新会话自动使用；已有会话保留创建时的 preset。

### 定点安装某个版本

上面的裸引用跟 main 走（`update` 时跟到最新）。要钉住某个 release：

```sh
dsh plugin --profile web add github:Yunado/dsh-qwen38-local-qol#v0.2.0
```

tag 不可变，钉住的引用不会自己漂移；`update` 也不会把你移开；升版 = 改 `#tag`。历史版本：[GitHub Releases](https://github.com/Yunado/dsh-qwen38-local-qol/releases)。

![生成的 qwen38 预设（Agent 预设页）](<docs/qwen38 preset-cn.png>)

## 功能特性

- **逐请求 thinking 预算。** llama.cpp 线每请求发送所选 effort 的预算（`reasoning_effort` + `reasoning_budget_tokens`，覆盖服务端 `--reasoning-budget`）；NInfer 引擎的 thinking 预算由服务端启动参数（`--default-thinking-budget`）决定；设置 tab 在 NInfer 线只显示说明（无输入），`defaultThinkingBudget` 字段保留为 headless/env 配置项；TabbyAPI 线两者都原生接受；oMLX 线（Apple Silicon MLX）原生接受顶层 `thinking_budget` 与 `chat_template_kwargs.enable_thinking`，逐请求按档发送。
- **压缩（compaction）后端。** 摘要 prefill 先裁剪（只留近 N 轮 reasoning、图片降为文本占位符、工具结果按字数帽截断），且压缩调用强制 thinking off + 该线完整输出帽，checkpoint 不再被 token 帽截断。
- **工具结果里的图片不再丢弃。** 嵌套在 tool-result 内的 image block（如 `read_image` 的结果）现在会上线：attachment 能解出 data URL 时，图以多模态 tool 消息（content 数组 + `image_url` 条目）发送；读不出来时用与用户侧相同的文本占位符，模型知道"这里有张图但看不见像素"。
- **设置 tab**：图形化配置四条服务线，即时生效。

## 设置 tab

DSH 设置 → **Qwen3.8 本地**：

![服务器线选择器：llama.cpp / NInfer / TabbyAPI / oMLX](<docs/qwen38 server-cn.png>)

![Qwen3.8 本地设置页](<docs/qwen38 tab-cn.png>)

按线记忆（连接、窗口数字、预算、裁剪旋钮）。状态圆点：绿 = `qwen38` 是默认 preset，黄 = 默认是别的 preset，灰 = preset 缺失。改动即时生效并持久化到 `settings.yaml`（热加载）。

## 可调项

设置 tab 是主入口；headless profile 或补丁/环境接受同样字段（按 id 定向的补丁替换整个 config，环境回退只覆盖补丁没写的字段）：

| 区域 | 字段（环境变量） | 默认 |
|---|---|---|
| 服务器 | `baseURL`、`model`、`displayName`、`apiKey`（`DSH_QWEN38_BASE_URL` / `_MODEL` / `_DISPLAY_NAME` / `_API_KEY`） | `http://localhost:8080/v1`（llama）/ `8082`（ninfer）/ `8083`（tabbyapi）/ `8000`（omlx）、模型别名、同 `model`、无 |
| 方言 | `dialect`（`DSH_QWEN38_DIALECT`） | `llamacpp`（可选：`ninfer`、`tabbyapi`、`omlx`） |
| 窗口 | `contextWindow`、`maxTokens`（`DSH_QWEN38_CONTEXT_WINDOW` / `_MAX_TOKENS`） | `262144`、`52428`（输出帽 ≈ 窗口的 20%，为 0.8× 压缩触发线留余量） |
| Thinking | `thinkingBudgets`（llamacpp + tabbyapi + omlx，按 effort）、`defaultThinkingBudget`（ninfer，仅 headless/env；tab 显示启动参数）、`defaultEffort`（`DSH_QWEN38_DEFAULT_EFFORT`） | `{ low: 4096, medium: 8192, xhigh: 16384 }`、`16384`、`medium` |
| Prefill 裁剪 | `DSH_QWEN38_SUMMARIZE_IMAGES`、`DSH_QWEN38_SUMMARIZE_KEEP_TURNS`、`DSH_QWEN38_SUMMARIZE_TOOL_CHARS`（仅环境变量） | `strip`、`5`、`2000` |

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

`github:` 依赖按精确 commit 解析。若 profile 锁文件仍钉在首次安装时的 commit，remove 后重新 add 插件即可强制重新解析。更新不触碰生成的 preset 与设置节。

## 卸载

1. `dsh plugin --profile web remove dsh-qwen38-local-qol`
2. 在 Agent 预设页删除 **`qwen38`** preset。
3. `~/.dsh/settings.yaml` 删掉 `agent-presets: { default: qwen38 }`。
4. 重启 DSH。

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
