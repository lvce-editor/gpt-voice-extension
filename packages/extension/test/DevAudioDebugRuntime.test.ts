import { expect, test } from '@jest/globals'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'

const require = createRequire(import.meta.url)

const getRendererBundle = (): string => {
  const packageJsonPath = require.resolve(
    '@lvce-editor/static-server/package.json',
  )
  const staticDirectory = join(dirname(packageJsonPath), 'static')
  const rendererRelativePath = join(
    'packages',
    'renderer-process',
    'dist',
    'rendererProcessMain.js',
  )
  const revision = readdirSync(staticDirectory).find((entry) =>
    existsSync(join(staticDirectory, entry, rendererRelativePath)),
  )
  if (!revision) {
    throw new Error('Could not find the dev renderer bundle')
  }
  return readFileSync(
    join(staticDirectory, revision, rendererRelativePath),
    'utf8',
  )
}

test('dev runtime captures one microphone recording per stopped speech turn', () => {
  const rendererBundle = getRendererBundle()

  expect(rendererBundle).toContain('input_audio_buffer.speech_stopped')
  expect(rendererBundle).toContain('MediaRecorder')
  expect(rendererBundle).toContain('requestData')
  expect(rendererBundle).toContain('audioDebugPort')
})
