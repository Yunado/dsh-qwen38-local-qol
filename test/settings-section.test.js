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
  DEFAULT_LLAMA_BASE_URL,
  DEFAULT_LLAMA_MODEL,
  DEFAULT_MAX_TOKENS,
  DEFAULT_MODEL,
  DEFAULT_THINKING_BUDGETS,
} from '../src/config.js'
import { DEFAULT_TRIM_KNOBS } from '../src/prepare.js'

test('NS: the plugin owns one lowercase hyphenated namespace', () => {
  assert.equal(NS, 'qwen38-local-qol')
})

test('sectionSchema: a fully-default value opens on the general default (llama.cpp line)', () => {
  const schema = sectionSchema()
  const resolved = schema({})
  assert.equal(resolved.dialect, 'llamacpp')
  assert.equal(resolved.baseURL, DEFAULT_BASE_URL)
  assert.equal(resolved.model, DEFAULT_MODEL)
  assert.equal(resolved.displayName, '')
  assert.equal(resolved.apiKey, '')
  assert.equal(resolved.contextWindow, DEFAULT_CONTEXT_WINDOW)
  assert.equal(resolved.maxTokens, DEFAULT_MAX_TOKENS)
  assert.deepEqual(resolved.thinkingBudgets, DEFAULT_THINKING_BUDGETS)
  assert.equal(resolved.defaultThinkingBudget, 16384)
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

test('sectionSchema: lines carry each dialect production defaults (connection + window + thinking budget + trim knobs)', () => {
  const resolved = sectionSchema()({})
  assert.deepEqual(resolved.lines.ninfer, {
    baseURL: DEFAULT_BASE_URL,
    model: DEFAULT_MODEL,
    displayName: '',
    contextWindow: DEFAULT_CONTEXT_WINDOW,
    maxTokens: DEFAULT_MAX_TOKENS,
    thinkingBudgets: { ...DEFAULT_THINKING_BUDGETS },
    defaultThinkingBudget: 16384,
    summarize: { images: 'strip', keepTurns: 5, toolChars: 2000 },
  })
  assert.equal(resolved.lines.llamacpp.baseURL, DEFAULT_LLAMA_BASE_URL)
  assert.equal(resolved.lines.llamacpp.model, DEFAULT_LLAMA_MODEL)
  assert.equal(resolved.lines.llamacpp.contextWindow, DEFAULT_CONTEXT_WINDOW)
  assert.equal(resolved.lines.llamacpp.maxTokens, DEFAULT_MAX_TOKENS)
})

test('sectionSchema: a user-saved line persists over its own defaults', () => {
  const resolved = sectionSchema()({
    lines: { llamacpp: { baseURL: 'http://127.0.0.1:9999/v1', model: 'some-alias', displayName: 'LLM', contextWindow: 131072, defaultThinkingBudget: 32768, summarize: { images: 'keep', keepTurns: 3, toolChars: 1000 } } },
  })
  assert.equal(resolved.lines.llamacpp.baseURL, 'http://127.0.0.1:9999/v1')
  assert.equal(resolved.lines.llamacpp.model, 'some-alias')
  assert.equal(resolved.lines.llamacpp.displayName, 'LLM')
  assert.equal(resolved.lines.llamacpp.contextWindow, 131072)
  assert.equal(resolved.lines.llamacpp.maxTokens, DEFAULT_MAX_TOKENS)
  assert.equal(resolved.lines.llamacpp.defaultThinkingBudget, 32768)
  assert.equal(resolved.lines.llamacpp.summarize.images, 'keep')
  assert.equal(resolved.lines.llamacpp.summarize.keepTurns, 3)
  assert.equal(resolved.lines.llamacpp.summarize.toolChars, 1000)
  // The untouched line keeps its defaults.
  assert.equal(resolved.lines.ninfer.contextWindow, DEFAULT_CONTEXT_WINDOW)
  assert.equal(resolved.lines.ninfer.defaultThinkingBudget, 16384)
})

test('sectionSchema: a wrong-typed line field is rejected', () => {
  assert.throws(() => sectionSchema()({ lines: { ninfer: { baseURL: 42 } } }))
  assert.throws(() => sectionSchema()({ lines: { ninfer: { contextWindow: 'wide' } } }))
})

test('validateSection: a non-positive parked line window fails loud', () => {
  const value = { ...sectionSchema()({}), lines: { llamacpp: { ...sectionSchema()({}).lines.llamacpp, maxTokens: 0 } } }
  assert.throws(() => validateSection(value), /lines\.llamacpp\.maxTokens/)
})

test('validateSection: a non-positive parked line budget fails loud', () => {
  const value = {
    ...sectionSchema()({}),
    lines: { ninfer: { ...sectionSchema()({}).lines.ninfer, thinkingBudgets: { low: 4096, medium: -1, xhigh: 16384 } } },
  }
  assert.throws(() => validateSection(value), /lines\.ninfer\.thinkingBudgets\["medium"\]/)
})

test('validateSection: a non-positive parked line defaultThinkingBudget fails loud', () => {
  const value = { ...sectionSchema()({}), lines: { llamacpp: { ...sectionSchema()({}).lines.llamacpp, defaultThinkingBudget: 0 } } }
  assert.throws(() => validateSection(value), /lines\.llamacpp\.defaultThinkingBudget must be a positive integer/)
})

test('validateSection: an unknown parked line summarize.images policy fails loud', () => {
  const value = {
    ...sectionSchema()({}),
    lines: { ninfer: { ...sectionSchema()({}).lines.ninfer, summarize: { images: 'squish', keepTurns: 5, toolChars: 2000 } } },
  }
  assert.throws(() => validateSection(value), /lines\.ninfer\.summarize\.images must be/)
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

test('validateSection: a non-positive defaultThinkingBudget fails loud', () => {
  const value = { ...sectionSchema()({}), defaultThinkingBudget: 0 }
  assert.throws(() => validateSection(value), /defaultThinkingBudget must be a positive integer/)
})

test('validateSection: an unknown summarize.images policy fails loud', () => {
  const value = { ...sectionSchema()({}), summarize: { images: 'squish', keepTurns: 5, toolChars: 2000 } }
  assert.throws(() => validateSection(value), /summarize\.images must be/)
})

test('validateSection: negative summarize knobs fail loud', () => {
  const value = { ...sectionSchema()({}), summarize: { images: 'strip', keepTurns: -1, toolChars: 2000 } }
  assert.throws(() => validateSection(value), /summarize\.keepTurns must be/)
})
