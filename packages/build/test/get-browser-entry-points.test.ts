import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { getBrowserEntryPoints } from '../src/get-browser-entry-points.ts'

test('includes every browser and web-worker entry point', () => {
  const root = path.join('test', 'root')

  assert.deepEqual(getBrowserEntryPoints(root), {
    gptVoiceMain: path.join(
      root,
      'packages',
      'extension',
      'src',
      'gptVoiceMain.ts',
    ),
    voiceFunctionCallingWorkerMain: path.join(
      root,
      'packages',
      'voice-function-calling-worker',
      'src',
      'voiceFunctionCallingWorkerMain.ts',
    ),
    voiceSessionWorkerMain: path.join(
      root,
      'packages',
      'voice-session-worker',
      'src',
      'voiceSessionWorkerMain.ts',
    ),
  })
})
