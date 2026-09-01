/**
 * The function-plugin contract: exports, registration, and disposal.
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import * as plugin from '../src/index.js'
import { QwenLocalAdapter } from '../src/adapter.js'

test('plugin contract: named exports, no default export', () => {
  assert.equal(plugin.name, 'qwen38-local-qol')
  assert.deepEqual(plugin.inject, ['llm'])
  assert.equal(typeof plugin.apply, 'function')
  assert.equal(plugin.default, undefined)
})

test('apply: registers the configured routes with a QwenLocalAdapter and returns the handle', () => {
  let registered = null
  const ctx = {
    llm: {
      registerAdapter(routes, adapter) {
        registered = { routes, adapter }
        const handle = () => { handle.released = true }
        return handle
      },
    },
  }
  const handle = plugin.apply(ctx, { baseURL: 'http://a/v1', provider: ['qwen38', 'qwen38-2'] })
  assert.deepEqual(registered.routes, ['qwen38', 'qwen38-2'])
  assert.ok(registered.adapter instanceof QwenLocalAdapter)
  assert.equal(typeof handle, 'function')
  handle()
  assert.equal(handle.released, true)
})

test('apply: default config registers the single default route', () => {
  let registered = null
  const ctx = {
    llm: {
      registerAdapter(routes, adapter) {
        registered = routes
        return () => {}
      },
    },
  }
  plugin.apply(ctx, {})
  assert.deepEqual(registered, ['qwen38'])
})
