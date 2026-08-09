import { packageExtension } from '@lvce-editor/package-extension'
import { nodeResolve } from '@rollup/plugin-node-resolve'
import fs from 'node:fs'
import { createRequire } from 'node:module'
import path, { join } from 'node:path'
import { type Plugin, rollup } from 'rollup'
import { build as esbuildBuild } from 'esbuild'
import esbuild from 'rollup-plugin-esbuild'
import { root } from './root.ts'

const extension = path.join(root, 'packages', 'extension')
const media = path.join(extension, 'media')
const node = path.join(root, 'packages', 'node')
const voiceFunctionCallingWorker = path.join(
  root,
  'packages',
  'voice-function-calling-worker',
)
const require = createRequire(import.meta.url)
const commonjs = require('@rollup/plugin-commonjs') as () => Plugin

fs.rmSync(join(root, 'dist'), { recursive: true, force: true })

fs.mkdirSync(path.join(root, 'dist'))
fs.mkdirSync(path.join(root, 'dist', 'media'))

fs.copyFileSync(join(root, 'README.md'), join(root, 'dist', 'README.md'))
fs.copyFileSync(
  join(extension, 'extension.json'),
  join(root, 'dist', 'extension.json'),
)
fs.copyFileSync(
  join(media, 'gpt-voice.css'),
  join(root, 'dist', 'media', 'gpt-voice.css'),
)
fs.copyFileSync(
  join(media, 'voice-chat.svg'),
  join(root, 'dist', 'media', 'voice-chat.svg'),
)

const buildBundle = async (input: string, output: string): Promise<void> => {
  const bundle = await rollup({
    input,
    external: ['electron', 'node:*'],
    plugins: [
      nodeResolve({
        browser: true,
      }),
      commonjs(),
      esbuild({
        target: 'esnext',
      }),
    ],
    treeshake: {
      moduleSideEffects: false,
    },
  })

  await bundle.write({
    file: output,
    format: 'esm',
  })

  await bundle.close()
}

await Promise.all([
  buildBundle(
    join(extension, 'src', 'gptVoiceMain.ts'),
    join(root, 'dist', 'dist', 'gptVoiceMain.js'),
  ),
  buildBundle(
    join(
      voiceFunctionCallingWorker,
      'src',
      'voiceFunctionCallingWorkerMain.ts',
    ),
    join(root, 'dist', 'dist', 'voiceFunctionCallingWorkerMain.js'),
  ),
  esbuildBuild({
    bundle: true,
    entryPoints: [join(node, 'src', 'terminalNodeMain.ts')],
    external: ['node:*'],
    format: 'esm',
    outfile: join(root, 'dist', 'dist', 'terminalNodeMain.js'),
    platform: 'node',
    target: 'node24',
  }),
])

await packageExtension({
  highestCompression: true,
  inDir: join(root, 'dist'),
  outFile: join(root, 'extension.tar.br'),
})
