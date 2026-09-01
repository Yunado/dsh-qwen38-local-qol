/**
 * The user-settings section: namespace id, schema defaults mirroring the
 * production line, and the cross-field validation the schema cannot express.
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { NS, sectionSchema, validateSection } from '../src/settings-section.js'
import {
  DEFAULT_BASE_URL,
  DEFAULT_CONTEXT_WINDOW,
  DEFAULT_MAX_TOKENS,
  DEFAULT_MODEL,
  DEFAULT_THINKING_BUDGETS,
} from '../src/config.js'
import { DEFAULT_TRIM_KNOBS } from '../src/prepare.js'

test('NS: the plugin owns one lowercase hyphenated namespace', () => {
  assert.equal(NS, 'qwen38-local-qol')
})

test('sectionSchema: a fully-default value is the production line', () => {
  const schema = sectionSchema()
  const resolved = schema({})
  assert.equal(resolved.dialect, 'ninfer')
  assert.equal(resolved.baseURL, DEFAULT_BASE_URL)
  assert.equal(resolved.model, DEFAULT_MODEL)
  assert.equal(resolved.displayName, '')
  assert.equal(resolved.apiKey, '')
  assert.equal(resolved.contextWindow, DEFAULT_CONTEXT_WINDOW)
  assert.equal(resolved.maxTokens, DEFAULT_MAX_TOKENS)
  assert.deepEqual(resolved.thinkingBudgets, DEFAULT_THINKING_BUDGETS)
  assert.equal(resolved.defaultEffort, 'medium')
  assert.deepEqual(resolved.thinkingLevelMap, {})
  assert.equal(resolved.includeUsage, true)
  assert.equal(resolved.summarize.images, DEFAULT_TRIM_KNOBS.images)
  assert.equal(resolved.summarize.keepTurns, DEFAULT_TRIM_KNOBS.keepTurns)
  assert.equal(resolved.summarize.toolChars, DEFAULT_TRIM_KNOBS.toolChars)
})

test('sectionSchema: partial user layers fill the missing fields', () => {
  const schema = sectionSchema()
  const resolved = schema({ dialect: 'llamacpp', baseURL: 'http://127.0.0.1:8080/v1' })
  assert.equal(resolved.dialect, 'llamacpp')
  assert.equal(resolved.baseURL, 'http://127.0.0.1:8080/v1')
  assert.equal(resolved.model, DEFAULT_MODEL)
  assert.equal(resolved.contextWindow, DEFAULT_CONTEXT_WINDOW)
})

test('sectionSchema: wrong-typed fields are rejected', () => {
  const schema = sectionSchema()
  assert.throws(() => schema({ contextWindow: 'wide' }))
  assert.throws(() => schema({ includeUsage: 'yes' }))
})

test('sectionSchema: unknown keys pass through (a row base may carry `provider`)', () => {
  const schema = sectionSchema()
  const resolved = schema({ provider: ['qwen38'] })
  assert.deepEqual(resolved.provider, ['qwen38'])
})

test('validateSection: the production line passes', () => {
  const defaults = sectionSchema()({})
  assert.doesNotThrow(() => validateSection(defaults))
})

test('validateSection: an unknown dialect fails loud', () => {
  const value = { ...sectionSchema()({}), dialect: 'mistral' }
  assert.throws(() => validateSection(value), /dialect must be/)
})

test('validateSection: a defaultEffort without a declared budget fails loud', () => {
  const value = { ...sectionSchema()({}), defaultEffort: 'high' }
  assert.throws(() => validateSection(value), /defaultEffort "high" is not a declared effort/)
})

test('validateSection: off is always a valid defaultEffort', () => {
  const value = { ...sectionSchema()({}), defaultEffort: 'off' }
  assert.doesNotThrow(() => validateSection(value))
})

test('validateSection: a non-positive budget fails loud', () => {
  const value = { ...sectionSchema()({}), thinkingBudgets: { low: 0, medium: 8192, xhigh: 16384 } }
  assert.throws(() => validateSection(value), /thinkingBudgets\["low"\]/)
})

test('validateSection: an unknown summarize.images policy fails loud', () => {
  const value = { ...sectionSchema()({}), summarize: { images: 'squish', keepTurns: 5, toolChars: 2000 } }
  assert.throws(() => validateSection(value), /summarize\.images must be/)
})

test('validateSection: negative summarize knobs fail loud', () => {
  const value = { ...sectionSchema()({}), summarize: { images: 'strip', keepTurns: -1, toolChars: 2000 } }
  assert.throws(() => validateSection(value), /summarize\.keepTurns must be/)
})
