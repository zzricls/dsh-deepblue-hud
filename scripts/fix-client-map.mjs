// The Client bundle is wrapped in the `window.__ModuleLoader__.load({...})`
// envelope at build time, which shifts every generated line down by the banner's
// height and makes the emitted source map point at the wrong lines.
//
// This script realigns it: VLQ mappings are line-relative, so prepending one `;`
// per banner line is exactly the correction needed. Run after `tsdown`.
import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const bundlePath = path.join(root, 'lib', 'client.js')
const mapPath = `${bundlePath}.map`
const MARKER = '//#region dbh-bundle-body'

const bundle = await readFile(bundlePath, 'utf8')
const lines = bundle.split('\n')
const markerIndex = lines.findIndex(line => line.includes(MARKER))

if (markerIndex === -1) {
  console.error(`[fix-client-map] banner marker not found in ${bundlePath}; leaving the map untouched`)
  process.exitCode = 1
} else {
  const shift = markerIndex + 1
  const map = JSON.parse(await readFile(mapPath, 'utf8'))
  if (!map.mappings.startsWith(';'.repeat(shift))) {
    map.mappings = ';'.repeat(shift) + map.mappings
    await writeFile(mapPath, `${JSON.stringify(map)}\n`, 'utf8')
  }
  console.log(`[fix-client-map] shifted source map by ${shift} lines`)
}
