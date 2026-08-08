import * as esbuild from 'esbuild'
import path from 'node:path'
import { root } from './root.ts'

const extension = path.join(root, 'packages', 'extension')
const node = path.join(root, 'packages', 'node')
const voiceFunctionCallingWorker = path.join(
  root,
  'packages',
  'voice-function-calling-worker',
)
const outdir = path.join(extension, 'dist')

const browserContext = await esbuild.context({
  bundle: true,
  entryPoints: {
    gptVoiceMain: path.join(extension, 'src', 'gptVoiceMain.ts'),
    voiceFunctionCallingWorkerMain: path.join(
      voiceFunctionCallingWorker,
      'src',
      'voiceFunctionCallingWorkerMain.ts',
    ),
  },
  external: ['electron', 'node:*'],
  format: 'esm',
  outdir,
  platform: 'browser',
  sourcemap: true,
  target: 'esnext',
})

const nodeContext = await esbuild.context({
  bundle: true,
  entryPoints: [path.join(node, 'src', 'terminalNodeMain.ts')],
  external: ['node:*'],
  format: 'esm',
  outfile: path.join(outdir, 'terminalNodeMain.js'),
  platform: 'node',
  sourcemap: true,
  target: 'node24',
})

await Promise.all([browserContext.watch(), nodeContext.watch()])
