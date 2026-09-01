/**
 * Configuration resolution: defaults, environment fallbacks, and validation.
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { resolveConfig, DEFAULT_BASE_URL, DEFAULT_MODEL, DEFAULT_THINKING_BUDGETS } from '../src/config.js'

test('resolveConfig: built-in defaults match the production line', () => {
  const resolved = resolveConfig({}, {})
  assert.equal(resolved.baseURL, DEFAULT_BASE_URL)
  assert.equal(resolved.model, DEFAULT_MODEL)
  assert.equal(resolved.apiKey, undefined)
  assert.equal(resolved.dialect, 'ninfer')
  assert.equal(resolved.contextWindow, 229376)
  assert.equal(resolved.maxTokens, 24576)
  assert.deepEqual(resolved.thinkingBudgets, DEFAULT_THINKING_BUDGETS)
  assert.deepEqual(resolved.provider, ['qwen38'])
  // Usage reporting is conservative per dialect.
  assert.equal(resolved.includeUsage, false)
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

test('resolveConfig: invalid dialect fails loud', () => {
  assert.throws(() => resolveConfig({ dialect: 'vllm' }, {}), /dialect must be/)
})

test('resolveConfig: budget map drops malformed entries, falls back when all drop', () => {
  assert.deepEqual(resolveConfig({ thinkingBudgets: { low: 100, medium: 'x', xhigh: -3 } }, {}).thinkingBudgets, { low: 100 })
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
