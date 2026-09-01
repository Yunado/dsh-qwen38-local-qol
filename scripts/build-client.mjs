/**
 * Build the browser half into the DSH client-module format: a self-registering
 * classic script whose `factory(require)` returns the module namespace, with
 * `react` left external (the module table supplies the identity). The loader
 * executes the file as a plain script and collects the registration — top-level
 * `import`/`export` statements would be a syntax error there.
 *
 * Usage: `node scripts/build-client.mjs` (esbuild is a devDependency).
 */
import { build } from 'esbuild'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'

const PACKAGE_ID = 'dsh-qwen38-local-qol'

const result = await build({
  entryPoints: ['src/client.js'],
  bundle: true,
  format: 'cjs',
  platform: 'browser',
  target: 'es2022',
  external: ['react'],
  write: false,
  logLevel: 'silent',
})
const body = result.outputFiles[0].text

// The bundle body is CJS: it assigns `module.exports` to the ESM namespace.
// The wrapper declares the `module`/`exports`/`require` the body expects and
// hands the namespace back to the loader's registration queue.
const bundle =
  `window.__ModuleLoader__.load({\n`
  + `  id: ${JSON.stringify(PACKAGE_ID)},\n`
  + `  factory: (require) => {\n`
  + `    var module = { exports: {} };\n`
  + `    var exports = module.exports;\n`
  + `    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });\n`
  + body
  + `\n    return module.exports;\n  },\n`
  + `});\n`

mkdirSync('lib', { recursive: true })
writeFileSync('lib/client.js', bundle)
console.log(`built lib/client.js (${String(bundle.length)} bytes)`)

// Smoke: the built file self-registers and its factory returns the plugin face.
const fakeLoader = { load: (registration) => { globalThis.__registration = registration } }
const fakeWindow = { __ModuleLoader__: fakeLoader }
const reactStub = {
  createElement: () => null,
  useState: (initial) => [initial, () => {}],
  useEffect: () => {},
}
const fn = new Function('window', 'require', bundle)
fn(fakeWindow, (specifier) => {
  if (specifier === 'react') return reactStub
  throw new Error(`unexpected external ${specifier}`)
})
const registration = globalThis.__registration
if (registration.id !== PACKAGE_ID) throw new Error('registration id mismatch')
const face = registration.factory((specifier) => {
  if (specifier === 'react') return reactStub
  throw new Error(`unexpected external ${specifier}`)
})
for (const member of ['name', 'inject', 'apply']) {
  if (face[member] === undefined) throw new Error(`built bundle is missing export ${member}`)
}
console.log('smoke: self-registration + factory face verified')
void readFileSync
