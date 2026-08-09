import { expect, test } from '@jest/globals'
import * as GptVoiceStrings from '../src/parts/GptVoiceStrings/GptVoiceStrings.ts'

test('render labels', () => {
  expect(GptVoiceStrings.changeApiKey()).toBe('Change API key')
  expect(GptVoiceStrings.clearChat()).toBe('Clear Chat')
  expect(GptVoiceStrings.creatingToken()).toBe('Creating token')
  expect(GptVoiceStrings.idle()).toBe('idle')
  expect(GptVoiceStrings.inProgress()).toBe('In Progress')
  expect(GptVoiceStrings.realtimeMiniModel()).toBe(
    'Model: Realtime 2.1 mini (cheaper)',
  )
  expect(GptVoiceStrings.realtimeStandardModel()).toBe(
    'Model: Realtime 2.1 (better quality)',
  )
  expect(GptVoiceStrings.saveApiKey()).toBe('Save API key')
  expect(GptVoiceStrings.saving()).toBe('Saving...')
  expect(GptVoiceStrings.savingKey()).toBe('Saving key')
  expect(GptVoiceStrings.setUpOpenAiApiKey()).toBe('Set up your OpenAI API key')
  expect(GptVoiceStrings.startTalking()).toBe('Start talking')
  expect(GptVoiceStrings.stopTalking()).toBe('Stop talking')
  expect(GptVoiceStrings.useBetter()).toBe('Use better')
  expect(GptVoiceStrings.useCheap()).toBe('Use cheap')
})

test('API key messages', () => {
  expect(GptVoiceStrings.failedToClearOpenAiApiKey()).toBe(
    'Failed to clear OpenAI API key.',
  )
  expect(GptVoiceStrings.failedToCreateToken()).toBe('Failed to create token.')
  expect(GptVoiceStrings.failedToCreateTokenWithDetails()).toBe(
    'Failed to create token. Check your network and API key.',
  )
  expect(GptVoiceStrings.failedToSaveOpenAiApiKey()).toBe(
    'Failed to save OpenAI API key.',
  )
  expect(GptVoiceStrings.invalidOpenAiApiKey()).toBe(
    'OpenAI API key is invalid (401/403).',
  )
  expect(GptVoiceStrings.invalidOpenAiApiKeyFormat()).toBe(
    'OpenAI API key format looks invalid.',
  )
  expect(GptVoiceStrings.missingOpenAiApiKey()).toBe(
    'NO_API_KEY: OpenAI API key is not set.',
  )
  expect(GptVoiceStrings.missingOpenAiApiKeyPrompt()).toBe(
    'NO_API_KEY: Add your OpenAI API key above to start.',
  )
  expect(GptVoiceStrings.networkFailure()).toBe(
    'Network failure while creating token. Retry and check your internet connection.',
  )
  expect(GptVoiceStrings.openAiApiKeyRequired()).toBe(
    'OpenAI API key is required.',
  )
  expect(GptVoiceStrings.openAiApiKeyRequiredForVoice()).toBe(
    'OpenAI API key required to start a live voice session.',
  )
  expect(GptVoiceStrings.welcomeDescription()).toBe(
    'Your key is stored in extension secret storage. Press Save to continue.',
  )
})

test('view labels', () => {
  expect(GptVoiceStrings.gptVoice()).toBe('Gpt Voice')
  expect(GptVoiceStrings.gptVoiceDisplayName()).toBe('GptVoice')
})
