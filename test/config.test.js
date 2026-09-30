/**
 * Configuration resolution: defaults, environment fallbacks, and validation.
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { createVolatile, updateVolatile } from '@deepseek-ai/cosmokit'
import { resolveConfig, DEFAULT_BASE_URL, DEFAULT_LLAMA_BASE_URL, DEFAULT_MODEL, DEFAULT_LLAMA_MODEL, DEFAULT_THINKING_BUDGETS } from '../src/config.js'

test('resolveConfig: built-in defaults open on the general default (llama.cpp line)', () => {
  const resolved = resolveConfig({}, {})
  // The base-url default follows the dialect: both lines currently share the
  // standard llama-server port.
  assert.equal(resolved.baseURL, DEFAULT_LLAMA_BASE_URL)
  assert.equal(resolveConfig({ dialect: 'ninfer' }, {}).baseURL, DEFAULT_BASE_URL)
  // The model default follows the dialect: both lines currently share the
  // neutral line name (no quant suffix).
  assert.equal(resolved.model, DEFAULT_LLAMA_MODEL)
  assert.equal(resolveConfig({ dialect: 'ninfer' }, {}).model, DEFAULT_MODEL)
  assert.equal(resolved.apiKey, undefined)
  assert.equal(resolved.dialect, 'llamacpp')
  assert.equal(resolved.contextWindow, 131072)
  assert.equal(resolved.maxTokens, 16384)
  assert.deepEqual(resolved.thinkingBudgets, DEFAULT_THINKING_BUDGETS)
  assert.deepEqual(resolved.provider, ['qwen38'])
  // Usage reporting is on by default for both dialects: NInfer 0.5.0 and
  // llama-server both honor stream_options.include_usage (verified 2026-09).
  assert.equal(resolved.includeUsage, true)
})

test('resolveConfig: patch row beats environment, environment beats default', () => {
  const env = {
    DSH_QWEN38_BASE_URL: 'http://env-host:8080/v1',
    DSH_QWEN38_MODEL: 'env-model',
    DSH_QWEN38_DIALECT: 'llamacpp',
  }
  const fromEnv = resolveConfig({}, env)
  assert.equal(fromEnv.baseURL, 'http://env-host:8080/v1')
  assert.equal(fromEnv.model, 'env-model')
  assert.equal(fromEnv.dialect, 'llamacpp')
  assert.equal(fromEnv.includeUsage, true)

  const fromRow = resolveConfig({ baseURL: 'http://row-host:8082/v1' }, env)
  assert.equal(fromRow.baseURL, 'http://row-host:8082/v1')
  assert.equal(fromRow.model, 'env-model')
})

test('resolveConfig: empty strings count as unset; llamacpp default includeUsage', () => {
  const resolved = resolveConfig({ baseURL: '   ', dialect: 'llamacpp' }, {})
  assert.equal(resolved.baseURL, DEFAULT_LLAMA_BASE_URL)
  assert.equal(resolved.includeUsage, true)
})

test('resolveConfig: includeUsage is explicit-only, both dialects default on', () => {
  assert.equal(resolveConfig({ includeUsage: false }, {}).includeUsage, false)
  assert.equal(resolveConfig({ includeUsage: true, dialect: 'llamacpp' }, {}).includeUsage, true)
})

test('resolveConfig: displayName resolves row over env and stays unset without either', () => {
  const env = { DSH_QWEN38_DISPLAY_NAME: 'Env Name' }
  assert.equal(resolveConfig({}, env).displayName, 'Env Name')
  assert.equal(resolveConfig({ displayName: 'Row Name' }, env).displayName, 'Row Name')
  assert.equal(resolveConfig({}, {}).displayName, undefined)
})

test('resolveConfig: defaultEffort defaults to medium, row beats env, invalid effort fails loud', () => {
  const env = { DSH_QWEN38_DEFAULT_EFFORT: 'low' }
  assert.equal(resolveConfig({}, env).defaultEffort, 'low')
  assert.equal(resolveConfig({ defaultEffort: 'xhigh' }, env).defaultEffort, 'xhigh')
  assert.equal(resolveConfig({}, {}).defaultEffort, 'medium')
  assert.throws(() => resolveConfig({ defaultEffort: 'max' }, {}), /defaultEffort "max" is not a declared effort/)
  assert.equal(resolveConfig({ defaultEffort: 'off' }, {}).defaultEffort, 'off')
})

test('resolveConfig: invalid dialect fails loud', () => {
  assert.throws(() => resolveConfig({ dialect: 'vllm' }, {}), /dialect must be/)
})

test('resolveConfig: the tabbyapi line opens on its own defaults', () => {
  const resolved = resolveConfig({ dialect: 'tabbyapi' }, {})
  assert.equal(resolved.dialect, 'tabbyapi')
  assert.equal(resolved.baseURL, 'http://localhost:8083/v1')
  assert.equal(resolved.model, 'Qwen3.8-Flash-Next-4.05bpw')
  assert.equal(resolved.contextWindow, 131072)
  assert.equal(resolved.maxTokens, 16384)
})

test('resolveConfig: the omlx line opens on its own endpoint with shared window defaults, and supports OMLX_API_KEY', () => {
  const resolved = resolveConfig({ dialect: 'omlx' }, {})
  assert.equal(resolved.dialect, 'omlx')
  assert.equal(resolved.baseURL, 'http://localhost:8000/v1')
  assert.equal(resolved.model, 'Qwen3.8-27B-MLX-8bit')
  assert.equal(resolved.contextWindow, 131072)
  assert.equal(resolved.maxTokens, 16384)

  const withKey = resolveConfig({ dialect: 'omlx' }, { OMLX_API_KEY: 'sk-test-key' })
  assert.equal(withKey.apiKey, 'sk-test-key')

  const dshKeyTakesPrecedence = resolveConfig({ dialect: 'omlx' }, { DSH_QWEN38_API_KEY: 'dsh-key', OMLX_API_KEY: 'omlx-key' })
  assert.equal(dshKeyTakesPrecedence.apiKey, 'dsh-key')
})

test('resolveConfig: budget map drops malformed entries, falls back when all drop', () => {
  // The default defaultEffort (medium) must be a declared effort, so the
  // partial-budget case names one explicitly; an all-drop map keeps the
  // built-in budgets, where medium is declared.
  assert.deepEqual(resolveConfig({ thinkingBudgets: { low: 100, medium: 'x', xhigh: -3 }, defaultEffort: 'low' }, {}).thinkingBudgets, { low: 100 })
  assert.deepEqual(resolveConfig({ thinkingBudgets: { low: 'x' } }, {}).thinkingBudgets, DEFAULT_THINKING_BUDGETS)
})

test('resolveConfig: integer settings accept positive integers only, env accepts digit strings', () => {
  assert.equal(resolveConfig({ contextWindow: 0 }, {}).contextWindow, 131072)
  assert.equal(resolveConfig({ contextWindow: 123 }, {}).contextWindow, 123)
  assert.equal(resolveConfig({}, { DSH_QWEN38_CONTEXT_WINDOW: '99999' }).contextWindow, 99999)
  assert.equal(resolveConfig({}, { DSH_QWEN38_CONTEXT_WINDOW: 'abc' }).contextWindow, 131072)
})

test('resolveConfig: provider list trims and filters empties, falls back when empty', () => {
  assert.deepEqual(resolveConfig({ provider: [' a ', '', 'b'] }, {}).provider, ['a', 'b'])
  assert.deepEqual(resolveConfig({ provider: [] }, {}).provider, ['qwen38'])
})

test('resolveConfig: the line selector activates the named lines block wholesale', () => {
  const base = {
    line: 'tabbyapi',
    baseURL: 'http://flat/v1',
    model: 'flat-model',
    lines: {
      tabbyapi: { baseURL: 'http://localhost:8083/v1', model: 'Flash-Next-EXL3', contextWindow: 131072, maxTokens: 32768, apiKey: 'k9' },
      ninfer: { baseURL: 'http://localhost:8082/v1', model: 'ninfer-line' },
    },
  }
  const resolved = resolveConfig(base, {})
  assert.equal(resolved.dialect, 'tabbyapi')
  assert.equal(resolved.baseURL, 'http://localhost:8083/v1')
  assert.equal(resolved.model, 'Flash-Next-EXL3')
  assert.equal(resolved.contextWindow, 131072)
  assert.equal(resolved.maxTokens, 32768)
})

test('resolveConfig: empty or unknown line keeps the legacy flat form authoritative', () => {
  assert.equal(resolveConfig({ line: '', baseURL: 'http://flat/v1' }, {}).baseURL, 'http://flat/v1')
  // A line naming a block the config does not carry changes nothing but the
  // dialect guard still runs (flat dialect stays the flat one).
  const resolved = resolveConfig({ line: 'omlx', dialect: 'ninfer', baseURL: 'http://flat/v1' }, {})
  assert.equal(resolved.baseURL, 'http://flat/v1')
  assert.equal(resolved.dialect, 'ninfer')
})

test('resolveConfig: volatile leaf refs (0.2.0 hosts) unwrap, nested included, and track hot commits', () => {
  // The parsed Config a 0.2.0 host hands the plugin: every .volatile() leaf
  // (flat and nested) is a live ref object, not a primitive.
  const config = {
    dialect: createVolatile('llamacpp'),
    model: createVolatile('qwen3.8-27b'),
    displayName: createVolatile(''),
    maxTokens: createVolatile(52428),
    thinkingBudgets: { low: createVolatile(1024), medium: createVolatile(8192), xhigh: createVolatile(16384) },
    lines: { ninfer: { model: createVolatile('ninfer-line'), apiKey: createVolatile('') } },
  }
  const resolved = resolveConfig(config, {})
  assert.equal(resolved.model, 'qwen3.8-27b')
  assert.equal(resolved.maxTokens, 52428)
  assert.equal(resolved.thinkingBudgets.medium, 8192)
  // A hot commit mutates the ref in place; the next read sees the new value
  // (this is the line-switch the settings tab performs).
  updateVolatile(config.model, createVolatile('Qwen3.8-Flash-Next'))
  assert.equal(resolveConfig(config, {}).model, 'Qwen3.8-Flash-Next')
  // Nested refs unwrap in the line-selector form too.
  const switched = resolveConfig({ ...config, line: createVolatile('ninfer') }, {})
  assert.equal(switched.dialect, 'ninfer')
  assert.equal(switched.model, 'ninfer-line')
})
