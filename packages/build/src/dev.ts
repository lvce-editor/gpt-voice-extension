import * as esbuild from 'esbuild'
import { spawn } from 'node:child_process'
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

await Promise.all([browserContext.rebuild(), nodeContext.rebuild()])
await Promise.all([browserContext.watch(), nodeContext.watch()])

const server = spawn(
  process.execPath,
  [
    path.join(
      root,
      'node_modules',
      '@lvce-editor',
      'server',
      'bin',
      'server.js',
    ),
    '--only-extension=packages/extension',
    '--test-path=packages/e2e',
  ],
  {
    cwd: root,
    env: {
      ...process.env,
      PORT: process.env.PORT || '3000',
    },
    stdio: 'inherit',
  },
)

const stop = async () => {
  server.kill()
  await Promise.all([browserContext.dispose(), nodeContext.dispose()])
}

process.on('SIGINT', async () => {
  await stop()
  process.exit(0)
})

process.on('SIGTERM', async () => {
  await stop()
  process.exit(0)
})

server.on('exit', async (code) => {
  await Promise.all([browserContext.dispose(), nodeContext.dispose()])
  process.exit(code ?? 0)
})
