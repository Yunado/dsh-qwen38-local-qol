/**
 * Configuration resolution: defaults, environment fallbacks, and validation.
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { resolveConfig, DEFAULT_BASE_URL, DEFAULT_MODEL, DEFAULT_THINKING_BUDGETS } from '../src/config.js'

test('resolveConfig: built-in defaults open on the general default (llama.cpp line)', () => {
  const resolved = resolveConfig({}, {})
  assert.equal(resolved.baseURL, DEFAULT_BASE_URL)
  assert.equal(resolved.model, DEFAULT_MODEL)
  assert.equal(resolved.apiKey, undefined)
  assert.equal(resolved.dialect, 'llamacpp')
  assert.equal(resolved.contextWindow, 229376)
  assert.equal(resolved.maxTokens, 24576)
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
  assert.equal(resolved.baseURL, DEFAULT_BASE_URL)
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

test('resolveConfig: budget map drops malformed entries, falls back when all drop', () => {
  // The default defaultEffort (medium) must be a declared effort, so the
  // partial-budget case names one explicitly; an all-drop map keeps the
  // built-in budgets, where medium is declared.
  assert.deepEqual(resolveConfig({ thinkingBudgets: { low: 100, medium: 'x', xhigh: -3 }, defaultEffort: 'low' }, {}).thinkingBudgets, { low: 100 })
  assert.deepEqual(resolveConfig({ thinkingBudgets: { low: 'x' } }, {}).thinkingBudgets, DEFAULT_THINKING_BUDGETS)
})

test('resolveConfig: integer settings accept positive integers only, env accepts digit strings', () => {
  assert.equal(resolveConfig({ contextWindow: 0 }, {}).contextWindow, 229376)
  assert.equal(resolveConfig({ contextWindow: 123 }, {}).contextWindow, 123)
  assert.equal(resolveConfig({}, { DSH_QWEN38_CONTEXT_WINDOW: '99999' }).contextWindow, 99999)
  assert.equal(resolveConfig({}, { DSH_QWEN38_CONTEXT_WINDOW: 'abc' }).contextWindow, 229376)
})

test('resolveConfig: provider list trims and filters empties, falls back when empty', () => {
  assert.deepEqual(resolveConfig({ provider: [' a ', '', 'b'] }, {}).provider, ['a', 'b'])
  assert.deepEqual(resolveConfig({ provider: [] }, {}).provider, ['qwen38'])
})
