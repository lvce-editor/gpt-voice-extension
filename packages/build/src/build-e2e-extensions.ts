import { build } from 'esbuild'
import path from 'node:path'
import { root } from './root.ts'

const formatter = path.join(
  root,
  'packages',
  'e2e',
  'fixtures',
  'format-document',
  'formatter',
)

await build({
  bundle: true,
  entryPoints: [path.join(formatter, 'main.js')],
  external: ['electron', 'node:*'],
  format: 'esm',
  outfile: path.join(formatter, 'dist', 'main.js'),
  platform: 'browser',
  target: 'esnext',
})
