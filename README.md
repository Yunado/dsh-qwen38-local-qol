# dsh-qwen38-local-qol

DeepSeek Harness QoL plugin for the local Qwen3.8 line — **Qwen3.8-27B**
(llama.cpp `llama-server` or NInfer) and, at the config level,
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

One package, two registrations:

| Registration | Seam | Mount |
|---|---|---|
| `QwenLocalAdapter` (provider route `qwen38`) | `ctx.llm.registerAdapter()` | the bundle patch (`cordis.patch.yml`) on the profile root |
| `QwenLocalCompaction` (compaction backend) | subclass of `@deepseek-ai/dsh-compaction-basic` | the generated **user preset** `~/.dsh/.agent-presets/qwen38-qol/agent.cordis.yml` (the per-session agent preset owns the isolated compaction group; profile-level patches do not reach it) |

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
| `model` | `DSH_QWEN38_MODEL` | `qwen3.8-27b-nvfp4-uncensored` | model id sent when a request omits one (the NInfer 0.5.0 artifact id; the llama.cpp line serves its own id — set this field or the env there) |
| `displayName` | `DSH_QWEN38_DISPLAY_NAME` | the model id | human-readable name for the GUI model selector (the wire id is an artifact alias) |
| `apiKey` | `DSH_QWEN38_API_KEY` | — | server `--api-key`, when set |
| `dialect` | `DSH_QWEN38_DIALECT` | `ninfer` | `ninfer` or `llamacpp` (the thinking wire) |
| `contextWindow` | `DSH_QWEN38_CONTEXT_WINDOW` | `229376` | declared context capacity (pressure compaction requires it) |
| `maxTokens` | `DSH_QWEN38_MAX_TOKENS` | `24576` | declared per-request output cap |
| `thinkingBudgets` | — | `{ low: 4096, medium: 8192, xhigh: 16384 }` | per-effort hard thinking budgets; the declared effort vocabulary is `off` + these keys |
| `defaultEffort` | `DSH_QWEN38_DEFAULT_EFFORT` | `medium` | effort materialized into requests that omit one; must be `off` or a `thinkingBudgets` key. Declaring it (any value) suppresses the core selector's "Default" row, which is redundant with `off` on this line |
| `thinkingLevelMap` | — | identity | effort id → wire effort name |
| `includeUsage` | — | `true` for `llamacpp`, `false` for `ninfer` | request `stream_options.include_usage` |
| `provider` | — | `["qwen38"]` | the provider route(s) to register |

Compaction trim knobs (environment only, so the preset row carries no keys the
stock config schema does not know):

| Env | Default | Meaning |
|---|---|---|
| `DSH_QWEN38_SUMMARIZE_IMAGES` | `strip` | `strip` reduces image blocks to text placeholders; `keep` retains them |
| `DSH_QWEN38_SUMMARIZE_KEEP_TURNS` | `5` | assistant turns at the region tail whose reasoning is kept |
| `DSH_QWEN38_SUMMARIZE_TOOL_CHARS` | `2000` | per-tool-result character cap; `0` disables |

The generated preset pins the backend row's `maxTokens` to `16384` (the stock
8192 default is the cap thinking used to eat before this backend existed).

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
  reasoning-budget build does; NInfer 0.5.0 does not — the field is optional
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
pnpm test          # node --test
```

Raw ESM JavaScript with JSDoc (the dsh-llamacpp shipping pattern); no build
step. Peer pins: `@deepseek-ai/cordis ^4.0.1`, `@deepseek-ai/dsh-llm
^0.1.1-rc.2` (verified against the npm 0.1.1-rc.2 line; developed and
machine-verified on the 0.1.2-alpha.3 source tree).

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
