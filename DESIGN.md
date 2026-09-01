# dsh-qwen38-local-qol — 设计稿

> 一个 DSH 插件，让 **stock dsh（零核心补丁、零 pi-ai patchfile）** 跑好本地
> Qwen3.8 线（27B + Flash-Next；llama-server / NInfer）：逐请求 thinking 预算
> + 长会话 compaction 不再被 thinking 吃满帽子。
>
> 内容来源 = 现网验证过的两条补丁链（compaction 9-file + reasoning 13-file），
> 从"每版 dsh 重切核心 diff"改造成"依赖公共缝的插件"。

## 1. 名字（已定）

**`dsh-qwen38-local-qol`**（用户两轮定名：先留 27b 防 Flash-Next 混淆 → 用户本机
Flash-Next 也好用 → 家族级命名，不锁尺寸；"qol" = 定位诚实：本地 Qwen 线的
生活质量层，不抢 dsh-dcp（确定性压缩）/ dsh-llamacpp（text-only adapter）生态位）。

- 仓库：`Yunado/dsh-qwen38-local-qol`（单包）
- tagline: "Local Qwen3.8 line for DeepSeek Harness — per-request thinking
  budgets + compaction that survives long thinking sessions. Built for the
  Qwen3.8-27B line (llama.cpp + NInfer); Qwen3.8-Flash-Next runs on the same
  llama.cpp dialect (user-verified)."

### 家族兼容（Qwen3.8-Flash-Next，2026-08-26 发布）

Flash-Next = 超稀疏 MoE（125B 主模型 + 51B n-gram embedding，6B active/token，
"Qwen4 architecture preview"，262K ctx）。兼容 = **配置级**：

| 维度 | Flash-Next |
|---|---|
| server 路由 | llama.cpp（Unsloth `qwen4exp` 分支）/ vLLM / SGLang——全是 OpenAI 兼容 `/v1/chat/completions`，adapter 同 wire，改 `baseURL`/`model` |
| effort 方言 | Qwen3.8 家族模板统一支持 `reasoning_effort`/`enable_thinking`（家族默认 xhigh = 过度思考问题本身） |
| thinking budget | 服务端执行（llama `--reasoning-budget` / vLLM 机制）；服务端不支持则优雅降级（发送不报错） |
| compaction 半区 | summarizer 层行为，模型/架构无关 |
| NInfer | 暂无 Flash-Next 工件（0.5.0 只有 27B NVFP4）→ 现仅 llama/vLLM 线 |

## 2. 架构：一个包，两个 registration（都是 effects）

DSH 插件契约（cookbook `adding-a-package.md`）：plugin = `name/inject/apply/Config`，
所有贡献走 `ctx.effect()` / `ctx.on()`，registry `register()` 返回 disposer。

| 半区 | 缝 | 做法 |
|---|---|---|
| A：reasoning/effort | `ctx.llm.registerAdapter(['qwen38'], adapter)`（dsh-llamacpp 同款缝） | 自研 provider adapter：双方言 wire + 逐请求 thinking budget + vision + tools + reasoning_tokens usage。**不走 pi-ai**（pi-ai 补丁是 build-time 的，插件够不着） |
| B：compaction | compaction backend 缝（docs/subsystems/compaction.md："a tokenizer- or template-based backend is a sibling package implementing the same interface"；`summarize()` = sole subclass hook） | **subclass compaction-basic backend**，override `summarize(input, owner, abort)`：reasoning-off 派发 + 三裁剪（剥图 / 近 5 轮 reasoning / tool 结果 2000 字——逻辑从现有补丁原样搬），复用导出的 `frameSummary` / `summarizeWithLlm` 保住 warm-prefix 缓存重放 |

### 挂载（M0 判定后定稿——web profile 的 compaction 活体在 per-session preset，profile patch 够不着）

**M0 证据**（dump + 源码）：web profile root 层的 compaction 行（compaction-basic /
command-compact / tool-result-pruner）全被 dsh-web-app 补丁 `disabled: true`；
真正压缩 = standard agent preset 的 isolated group（preset 文件按原样 standing
mount，agent-presets 无 patch 流）。dsh-dcp 的 root 层接管只在 root 行开启的
profile（其 tui profile）有效。

因此两半区两个落点：

```yaml
# cordis.patch.yml（bundle patch → root 层，provider 行）
- insert:
    - id: qwen38
      name: dsh-qwen38-local-qol
      config:
        baseURL: http://127.0.0.1:8082/v1
        model: qwen3.8-27b-nvfp4-uncensored
        dialect: ninfer
        contextWindow: 229376
        maxTokens: 24576
        thinkingBudgets: { low: 4096, medium: 8192, xhigh: 16384 }
```

```yaml
# compaction backend 行 → 用户 preset 缝（~/.dsh/.agent-presets/qwen38-qol/agent.cordis.yml）
# 由 setup 脚本从【当前安装的】standard preset 生成（抄全量 + compaction 组内
# compaction-basic 行替换为我们的 backend 行）→ 跟版无手工漂移
- id: compaction
  name: cordis:group
  group: true
  isolate:
    compaction: true
    toolResultPruner: true
  config:
    - id: compaction-basic
      name: dsh-qwen38-local-qol      # ← 我们的 backend（subclass basic）
    - id: command-compact
      name: '@deepseek-ai/dsh-command-compact'
    - id: tool-result-pruner
      name: '@deepseek-ai/dsh-compaction-tool-result-pruner'
      config: { thresholdChars: 8192, headChars: 4096, tailChars: 1024 }
```

- `package.json` 带 `dsh.bundle.patch: ./cordis.patch.yml` → `dsh plugin add
  github:Yunado/dsh-qwen38-local-qol` 挂 provider 行；`npx dsh-qwen38-local-qol-setup`
  生成用户 preset（幂等 + 备份，dsh-dcp setup 同款）；GUI 选 `qwen38-qol` preset。
- 离线验证 = `dsh --profile web --patch <yml> --dump-config`（root 层行落位已验：
  dump 538 行基线 provenance 全对；preset 层 = M1 headless boot 验证）。
- **M1 待核**：preset 目录的插件名解析（向上 node_modules 走查到不到
  profiles/web/node_modules）→ 备选 = 行内相对路径（preset 自带 lib，
  discovery.ts L246 "a row naming a file the preset ships resolves the way the mount will"）。

## 3. 缝证据（全部核实过）

| 缝 | 证据 |
|---|---|
| `summarize()` subclass hook | rc.2（b150a551b8）**与** alpha.3 都有：`protected async summarize(` + "sole subclass customization hook"；`summarizer.ts` 导出 `SummarizationInput` / `SummaryResult` / `summarizeWithLlm` / `frameSummary` |
| compaction 挂载语法 | fan56/dsh-dcp `cordis.patch.yml`：`- id: compaction-basic, disabled: true` + `- insert: - id: dsh-dcp, name: '@aiwayds/dsh-dcp'`；README："挂在 dsh 的压缩接口上，只替换'摘要'这一环，继承官方触发/保留/锁/tool-pairing"，65 测试 |
| provider adapter 缝 | jwilson411/dsh-llamacpp：`ctx.llm.registerAdapter(['llamacpp'], adapter)`；`LlmAdapter`/`LlmError`/`attributionHeaders`/`errorChain` 来自 `@deepseek-ai/dsh-llm`；text-only（vision/tool 块显式拒）——我们要做的正是它没做的部分 |
| 外部插件包结构 | 两个样板一致：`package.json`（type module、`dsh.bundle.patch`、peer+dev 双列 dsh 依赖、`overrides` 钉版、`node --test`）+ `cordis.patch.yml` + `lib/`（dsh-dcp）或 `src/`（dsh-llamacpp）+ README + LICENSE(MIT) |

## 4. 配置 schema

### Provider `qwen38`

| 键 | 类型 | 默认 | 说明 |
|---|---|---|---|
| `baseURL` | string | `http://127.0.0.1:8082/v1` | 含 `/v1`，不重复拼 |
| `model` | string | 必填 | 服务端 alias |
| `apiKey` | string | 无（不发 Authorization） | 或服务端 `--api-key` 同值 |
| `dialect` | `'ninfer' \| 'llamacpp'` | 必填 | 决定 effort/budget 的 wire 位置（见 §5） |
| `contextWindow` | int | 必填 | 透传给 harness 路由 |
| `maxTokens` | int | 必填 | 映射 `max_tokens`（llama-server 不读 `max_completion_tokens`） |
| `thinkingBudgets` | `{low, medium, xhigh}` | `{4096, 8192, 16384}` | 逐请求 `reasoning_budget_tokens`（llama 线，需服务端带 `--reasoning-budget` 补丁/消息）；NInfer 线发送但由服务端 `--default-thinking-budget` 封顶 |
| `vision` | bool | `true` | 图片块 → `image_url`（data URL） |

### Compaction `qwen38-compaction`

| 键 | 默认 | 说明 |
|---|---|---|
| `summarizeImages` | `'strip'` | 现有补丁 3 knob 原样（`'strip'\|'keep'`） |
| `summarizeReasoningKeepTurns` | `5` | `0` = 全剥 |
| `summarizeToolResultMaxChars` | `2000` | `0` = 不截 |
| `maxTokens` | `24576` | 摘要帽（绕开 preset isolated group 的 8192 死角：后端自持） |

## 5. Wire 映射（双方言，来自现网验证的 pi-ai 补丁分道）

| 请求件 | `dialect: 'llamacpp'`（llama-server + froggeric v22.1 jinja 模板） | `dialect: 'ninfer'`（0.5.0） |
|---|---|---|
| effort | `chat_template_kwargs.reasoning_effort`（模板 kwargs 白名单；顶层被忽略） | 顶层 `reasoning_effort` |
| effort off | `chat_template_kwargs.enable_thinking: false` | `reasoning_effort: 'none'` |
| thinking budget | `reasoning_budget_tokens`（服务端补丁输出 `completion_tokens_details.reasoning_tokens`） | 发送即忽略（服务端默认帽 16384） |
| vision | `image_url`（服务端 `--image-min/max-tokens` 强制 resize） | `image_url`（客户端预缩 ≤1024 长边） |
| tools | 标准 `tools` 数组 + `tool_calls` 流 | 同左 |
| maxTokens | `max_tokens` | `max_tokens` |

finish_reason 映射：`stop`→stop、`tool_calls`→tool-calls、`length`→**max-tokens**
（截断不当完成报，dsh-llamacpp 同款）。错误 = `LlmError` 稳定 code 表
（PROVIDER_UNREACHABLE / _HTTP_ERROR / _ERROR / _PROTOCOL_ERROR / UNSUPPORTED_CONTENT）。

## 6. 文件布局

```
dsh-qwen38-local-qol/
  package.json        # dsh.bundle.patch + peers(0.1.1-rc.2) + node --test
  cordis.patch.yml    # §3 挂载
  src/
    index.ts          # plugin：name/inject/apply/Config；两个 effect 注册
    provider/
      adapter.ts      # qwen38 LlmAdapter（stream 解析 + 映射）
      dialect.ts      # 双方言请求构建（§5 表）
      errors.ts       # LlmError code 表
    compaction/
      backend.ts      # Qwen38CompactionBackend extends basic（override summarize）
      trim.ts         # 三裁剪（从现有补丁 prepareMessagesForSummary 原样搬）
    config.ts         # 两半区 zod/schemastery schema
  test/
    dialect.test.js   # 双方言请求构建快照
    stream.test.js    # mock OpenAI server（node:http）：流/usage/finish/错误表
    compaction.test.js# trim + reasoning-off + frameSummary 复用
    bundle.test.js    # cordis.patch.yml 语法/挂载行
  build.mjs           # esbuild src→lib（单命令，无 pnpm 依赖）
  README.md           # 安装/配置/验证/与 dsh-llamacpp 与 dsh-dcp 的差异
  LICENSE             # MIT
```

## 7. 版本钉定

- peer/dev/overrides 钉 **`0.1.1-rc.2`**（npm latest；dsh-dcp 钉 rc.6、dsh-llamacpp
  钉 rc.2 同款策略）；`summarize()` 缝在 rc.2 已核实存在，alpha.3 树兼容性
  M0 实测（在 0.1.2-alpha.3 生产 profile 装插件跑一遍）。
- dsh 升版时：缝未变 → 只升 peer 钉定 + 跑测试；缝变了 → 单文件适配。
  **对比现状：每版重切 9+13-file 核心 diff（已切 3 次）。**

## 8. 测试计划（keyless，`node --test`）

1. dialect 构建：双方言 × {off, low, xhigh} 快照（含 enable_thinking:false 路径）
2. stream：mock server 覆盖 text-only / tool_calls 流 / usage(含 reasoning_tokens) /
   `length`→max-tokens / 非 2xx / 非 JSON frame / 图片块 / abort 透传
3. compaction：trim 三 knob（含 0 禁用）、reasoning-off 断言、frameSummary 输出
4. 挂载：patch 文件解析 + 行结构断言
5. 集成（M4，真机）：NInfer 线长会话 → compaction 触发 → checkpoint 无 thinking
   标签 + budget 逐请求生效证据（服务端日志）

## 9. 里程碑

| M | 内容 | 出口 |
|---|---|---|
| M0 | 缝验证 spike：① preset isolated compaction group 的 patch 语义（`id: compaction-basic` 行是否同时命中 isolated 组实例——Vali-D 8192 坑）② alpha.3 profile 装 rc.2-钉定插件的兼容性 | 结论 + 必要时挂载语法调整 |
| M1 | provider MVP：text + 双方言 effort/budget + 错误表 + 测试 | 真机 NInfer 一轮对话 |
| M2 | vision + tools round-trip + usage.reasoning_tokens + 测试补齐 | 真机带图 + 带工具轮 |
| M3 | compaction subclass + 挂载 + 测试 | 真机 /compact 手动触发成功 |
| M4 | 长会话压力：thinking 大帽下自动 compaction 通过 | 会话继续、checkpoint 干净 |
| M5 | README/keywords/发布（GitHub 仓 + npm 可选）+ discussion 3465 补评论 | 朋友 `dsh plugin add` 一条命令 |

## 10. 风险 / 开放项

1. **isolated compaction group**（最高风险）：standard preset 的 isolated 组若不受
   顶层 patch 行控制 → 挂载语法需按组定位（M0 定死）。
2. GUI 内置 effort picker 不显示（插件线 composer 无 effort 选项）→ 插件配置
   默认值兜底；要 picker 就还是走现网 pi-ai 补丁链（两条线可并存）。
3. 我们生产线迁移：插件与 pi-ai 链并存，迁移 = 后续 GO（不阻塞发布）。
4. dsh-dcp 生态位重叠：它是"零 LLM 确定性压缩"（不同卖点），我们在 README
   写明差异（我们要语义摘要 + 本地 thinking 模型场景）。
5. llama 线 `reasoning_tokens` usage 依赖 llama.cpp 服务端补丁（我们的 7 文件
   补丁）——无补丁时 usage 缺字段，插件容错（不报错，GUI 无逐轮 thinking 数）。
