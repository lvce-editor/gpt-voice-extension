import { expect, test } from '@jest/globals'
import { readFileSync } from 'node:fs'

const extensionManifest = JSON.parse(
  readFileSync(new URL('../extension.json', import.meta.url), 'utf8'),
)

test('isolates network access in the voice session worker', () => {
  expect(extensionManifest.contentSecurityPolicy).toEqual([
    "default-src 'none'",
    "script-src 'self'",
  ])
  expect(extensionManifest.rpc).toContainEqual({
    contentSecurityPolicy: [
      "default-src 'none'",
      "script-src 'self'",
      "connect-src 'self' https://api.openai.com wss://lvce-editor.dev",
    ],
    id: 'builtin.gpt-voice.voice-session-worker',
    name: 'Voice Session Worker',
    type: 'web-worker',
    url: 'dist/voiceSessionWorkerMain.js',
  })
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

test('uses a distinct audio recordings view icon', () => {
  expect(extensionManifest.views).toContainEqual(
    expect.objectContaining({
      icon: 'media/audio-recordings.svg',
      id: 'gpt-voice-audio.views.recordings',
    }),
  )
  expect(
    readFileSync(
      new URL('../media/audio-recordings.svg', import.meta.url),
      'utf8',
    ),
  ).toContain('aria-label="Audio recordings"')
})

test('declares audio processing settings and the opt-in terminal tool', () => {
  expect(extensionManifest.configuration).toEqual({
    'gptvoice.audio.autoGainControl': {
      default: false,
      description:
        'Allow the browser to automatically adjust microphone volume. Disable this if your voice becomes quieter during a message. Changes apply to new voice sessions.',
      type: 'boolean',
    },
    'gptvoice.audio.echoCancellation': {
      default: true,
      description:
        'Remove audio playing through speakers from microphone input. Changes apply to new voice sessions.',
      type: 'boolean',
    },
    'gptvoice.audio.noiseSuppression': {
      default: true,
      description:
        'Reduce steady background noise. Disable this if quiet speech is being removed. Changes apply to new voice sessions.',
      type: 'boolean',
    },
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
