import { expect, test } from '@jest/globals'
import { readFileSync } from 'node:fs'

const extensionManifest = JSON.parse(
  readFileSync(new URL('../extension.json', import.meta.url), 'utf8'),
)

test('allows the production funded voice websocket', () => {
  expect(extensionManifest.contentSecurityPolicy).toContain(
    "connect-src 'self' https://api.openai.com wss://lvce-editor.dev",
  )
})

test('declares the voice function calling web worker', () => {
  expect(extensionManifest.rpc).toContainEqual({
    contentSecurityPolicy: ["default-src 'none'", "script-src 'self'"],
    id: 'builtin.gpt-voice.voice-function-calling-worker',
    name: 'Voice Function Calling Worker',
    type: 'web-worker',
    url: 'dist/voiceFunctionCallingWorkerMain.js',
  })
})

test('uses the voice chat view icon', () => {
  expect(extensionManifest.views).toContainEqual(
    expect.objectContaining({
      icon: 'media/voice-chat.svg',
      id: 'gpt-voice.views.default',
      preferredLocation: 'secondaryPreview',
    }),
  )
  expect(
    readFileSync(new URL('../media/voice-chat.svg', import.meta.url), 'utf8'),
  ).toContain('aria-label="Voice chat"')
  expect(extensionManifest.views).toContainEqual(
    expect.objectContaining({
      id: 'gpt-voice-audio.views.recordings',
      title: 'Voice Audio Recordings',
    }),
  )
})

test('declares the opt-in terminal tool and node process', () => {
  expect(extensionManifest.configuration).toEqual({
    'gptvoice.audioDebug.enabled': {
      default: false,
      description:
        'Record the microphone audio sent during Gpt Voice messages and keep the recordings in cache storage for playback and transcription debugging.',
      type: 'boolean',
    },
    'gptvoice.tools.terminal.enabled': {
      default: false,
      description:
        'Allow Gpt Voice to execute Bash commands in the opened workspace. Enabling this gives the voice model arbitrary code execution access.',
      type: 'boolean',
    },
  })
  expect(extensionManifest.rpc).toContainEqual({
    id: 'builtin.gpt-voice.terminal-node',
    name: 'Gpt Voice Terminal',
    type: 'node-process',
    url: 'dist/terminalNodeMain.js',
  })
  expect(extensionManifest.fileSystemProviders).toContainEqual({
    id: 'gpt-voice-audio',
  })
  expect(extensionManifest.activation).toContain('onFileSystem:gpt-voice-audio')
})
