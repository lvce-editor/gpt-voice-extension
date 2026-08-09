import type { Test } from '@lvce-editor/test-with-playwright'

const fixture = {
  expect: {
    assistantText: 'Settings are filtered to font size.',
    toolCalls: [
      {
        arguments: {},
        name: 'open_settings',
        output: {
          opened: true,
        },
      },
      {
        arguments: {
          value: 'font size',
        },
        name: 'set_settings_search_value',
        output: {
          updated: true,
          value: 'font size',
        },
      },
    ],
    userText: 'Open settings and search for font size.',
  },
  name: 'open-settings',
  schemaVersion: 1,
  source: {
    realtimeModel: 'gpt-realtime-2.1-mini',
    text: 'Open settings and search for font size.',
  },
  trace: [
    {
      atMs: 0,
      direction: 'server',
      event: {
        delta: 'Open settings and search for font size.',
        item_id: 'user_item_1',
        type: 'conversation.item.input_audio_transcription.delta',
      },
    },
    {
      atMs: 350,
      direction: 'server',
      event: {
        arguments: '{}',
        call_id: 'call_1',
        name: 'open_settings',
        type: 'response.function_call_arguments.done',
      },
    },
    {
      atMs: 351,
      direction: 'client',
      event: {
        item: {
          call_id: 'call_1',
          output: '{"opened":true}',
          type: 'function_call_output',
        },
        type: 'conversation.item.create',
      },
    },
    {
      atMs: 352,
      direction: 'client',
      event: {
        type: 'response.create',
      },
    },
    {
      atMs: 500,
      direction: 'server',
      event: {
        arguments: '{"value":"font size"}',
        call_id: 'call_2',
        name: 'set_settings_search_value',
        type: 'response.function_call_arguments.done',
      },
    },
    {
      atMs: 501,
      direction: 'client',
      event: {
        item: {
          call_id: 'call_2',
          output: '{"updated":true,"value":"font size"}',
          type: 'function_call_output',
        },
        type: 'conversation.item.create',
      },
    },
    {
      atMs: 502,
      direction: 'client',
      event: {
        type: 'response.create',
      },
    },
    {
      atMs: 800,
      direction: 'server',
      event: {
        delta: 'Settings are filtered to font size.',
        item_id: 'assistant_item_1',
        type: 'response.output_audio_transcript.delta',
      },
    },
  ],
} as const
const expectedToolCallLabels = [
  'Ran open_settings',
  'Ran set_settings_search_value',
] as const

export const name = 'gpt-voice.fixture-open-settings'

export const test: Test = async ({ Command, expect, Locator, SideBar }) => {
  await Command.executeExtensionCommand('GptVoice.setIsTest')
  await SideBar.open('gpt-voice.views.default')

  await Command.executeExtensionCommand('GptVoice.replayFixture', fixture)

  const voice = Locator('.GptVoice')
  const userTranscript = Locator('.GptVoiceTranscriptItemUser')
  const assistantTranscript = Locator('.GptVoiceTranscriptItemAi')
  await expect(userTranscript).toHaveText(fixture.expect.userText)
  for (const label of expectedToolCallLabels) {
    await expect(voice).toContainText(label)
  }
  await expect(assistantTranscript).toHaveText(fixture.expect.assistantText)
  const settings = Locator('.Settings')
  const settingsSearchInput = Locator('.SettingsSearchInput')
  await expect(settings).toBeVisible()
  await expect(settingsSearchInput).toHaveAttribute(
    'placeholder',
    'Search Settings',
  )
  await expect(settingsSearchInput).toHaveValue('font size')
}
