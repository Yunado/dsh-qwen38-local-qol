#!/usr/bin/env node
/**
 * Generate the user preset that mounts the Qwen3.8 compaction backend inside
 * the agent preset's isolated compaction group.
 *
 * Reads the installed standard preset's `agent.cordis.yml`, swaps the
 * `compaction-basic` row for this package's backend (and pins its
 * `maxTokens`), and writes `~/.dsh/.agent-presets/qwen38-qol/agent.cordis.yml`
 * (a dated backup replaces any earlier generated copy). The generated preset
 * is regenerated from the live installed preset on every run, so it tracks
 * DSH releases without a re-cut diff.
 *
 * Usage:
 *   node src/setup.js [--src <preset agent.cordis.yml>]
 *   DSH_QWEN38_PRESET_SRC=<path> node src/setup.js
 *
 * @module dsh-qwen38-local-qol/setup
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync, copyFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'

/** The user preset directory, relative to the DSH home (`.agent-presets`). */
export const USER_PRESET_DIR = '.agent-presets'
/** The generated preset id (the directory name; shown in the GUI preset selector). */
export const PRESET_ID = 'qwen38-qol'
/** The backend row id inside the preset's compaction group. */
export const BACKEND_ROW_ID = 'compaction-basic'
/** The package this backend row must name. */
export const BACKEND_PACKAGE = 'dsh-qwen38-local-qol'
/** The stock config value pinned on the backend row (the 8192 default is the cap thinking used to eat). */
export const BACKEND_MAX_TOKENS = 16384

/**
 * Resolve the DSH home directory.
 * @param env - environment to read; defaults to `process.env`.
 * @returns the absolute DSH home path.
 */
export function resolveDshHome(env = process.env) {
  const home = env.DSH_HOME && String(env.DSH_HOME).trim() !== '' ? String(env.DSH_HOME).trim() : join(homedir(), '.dsh')
  return home
}

/**
 * Find the `name:` line that belongs to the first `- id: compaction-basic`
 * block: the next line, at the same or deeper indent, starting with `name:`.
 * @param lines - the split preset text.
 * @param idLine - the index of the `- id: compaction-basic` line.
 * @returns the index of the name line.
 */
export function findNameLine(lines, idLine) {
  for (let i = idLine + 1; i < lines.length; i += 1) {
    const line = lines[i]
    if (/^\s*- id:/.test(line)) throw new Error('dsh-qwen38-local-qol: setup: the compaction-basic row has no name: line')
    if (/^\s*name:/.test(line)) return i
  }
  throw new Error('dsh-qwen38-local-qol: setup: the compaction-basic row has no name: line')
}

/**
 * Rewrite the preset text so the compaction-basic row names this package's
 * backend and pins `maxTokens`. Strict anchors: exactly one `- id:
 * compaction-basic` row, exactly one following `name:` line; anything else
 * fails loud instead of writing a wrong preset.
 * @param text - the standard preset's agent.cordis.yml content.
 * @returns the rewritten preset text.
 */
export function transformPreset(text) {
  const lines = text.split('\n')
  const idLines = lines.map((line, i) => (/^\s*- id:\s*compaction-basic\s*$/.test(line) ? i : -1)).filter((i) => i !== -1)
  if (idLines.length === 0) {
    throw new Error('dsh-qwen38-local-qol: setup: no "- id: compaction-basic" row found; is the source preset a DSH agent preset?')
  }
  if (idLines.length > 1) {
    throw new Error(`dsh-qwen38-local-qol: setup: found ${idLines.length} "compaction-basic" rows; expected exactly one`)
  }
  const nameLine = findNameLine(lines, idLines[0])
  const indent = lines[nameLine].match(/^\s*/)[0]
  lines[nameLine] = `${indent}name: ${BACKEND_PACKAGE}`

  // Pin maxTokens unless the block already carries a config section.
  const blockEnd = lines.findIndex((line, i) => i > nameLine && /^\s*- id:/.test(line))
  const block = lines.slice(nameLine + 1, blockEnd === -1 ? lines.length : blockEnd)
  if (!block.some((line) => /^\s*config:/.test(line))) {
    lines.splice(nameLine + 1, 0, `${indent}config:`, `${indent}  maxTokens: ${BACKEND_MAX_TOKENS}`)
  }
  return lines.join('\n')
}

/**
 * Run the generator.
 * @param options - CLI options.
 * @param options.src - explicit path to the installed standard preset's agent.cordis.yml.
 * @param options.home - DSH home override (defaults to env DSH_HOME or ~/.dsh).
 * @returns the absolute path of the written preset file.
 */
export function generatePreset({ src, home } = {}) {
  const dshHome = home ?? resolveDshHome()
  const source = src ?? process.env.DSH_QWEN38_PRESET_SRC
  if (!source || !existsSync(source)) {
    throw new Error(
      'dsh-qwen38-local-qol: setup: no preset source found; pass --src <agent.cordis.yml> '
      + 'or set DSH_QWEN38_PRESET_SRC (the installed @deepseek-ai/dsh-agent-presets '
      + 'presets/standard/agent.cordis.yml)',
    )
  }
  const text = readFileSync(source, 'utf8')
  const transformed = transformPreset(text)
  const dir = join(dshHome, USER_PRESET_DIR, PRESET_ID)
  const target = join(dir, 'agent.cordis.yml')
  if (existsSync(target)) {
    copyFileSync(target, `${target}.bak-${new Date().toISOString().replace(/[:.]/g, '-')}`)
  }
  mkdirSync(dir, { recursive: true })
  writeFileSync(target, transformed)
  return target
}

const argv = process.argv.slice(2)
const srcFlag = argv.indexOf('--src')
const cliSrc = srcFlag !== -1 ? argv[srcFlag + 1] : undefined
if (process.argv[1] && process.argv[1].endsWith('setup.js')) {
  try {
    const written = generatePreset({ src: cliSrc })
    console.log(`dsh-qwen38-local-qol: preset written to ${written}`)
    console.log(`dsh-qwen38-local-qol: select the "${PRESET_ID}" agent preset in the GUI (per session).`)
  } catch (error) {
    console.error(error.message)
    process.exitCode = 1
  }
}
