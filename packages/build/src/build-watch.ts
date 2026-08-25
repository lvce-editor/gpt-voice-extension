import * as esbuild from 'esbuild'
import path from 'node:path'
import { getBrowserEntryPoints } from './get-browser-entry-points.ts'
import { root } from './root.ts'

const extension = path.join(root, 'packages', 'extension')
const node = path.join(root, 'packages', 'node')
const outdir = path.join(extension, 'dist')

const browserContext = await esbuild.context({
  bundle: true,
  entryPoints: getBrowserEntryPoints(root),
  external: ['electron', 'node:*'],
  format: 'esm',
  outdir,
  platform: 'browser',
  sourcemap: true,
  target: 'esnext',
})

const nodeContext = await esbuild.context({
  banner: {
    js: "import { createRequire as __createRequire } from 'node:module'; const require = __createRequire(import.meta.url);",
  },
  bundle: true,
  entryPoints: [path.join(node, 'src', 'terminalNodeMain.ts')],
  external: ['electron', 'node:*'],
  format: 'esm',
  outfile: path.join(outdir, 'terminalNodeMain.js'),
  platform: 'node',
  sourcemap: true,
  target: 'node24',
})

await Promise.all([browserContext.watch(), nodeContext.watch()])
