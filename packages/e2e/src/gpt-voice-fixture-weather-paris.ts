import type { Test } from '@lvce-editor/test-with-playwright'

const fixture = {
  expect: {
    assistantText:
      'It is sunny in Paris with a temperature of 20 degrees Celsius.',
    toolCalls: [
      {
        arguments: { location: 'Paris' },
        name: 'getweather',
        output: {
          conditions: 'Sunny',
          humidity: 58,
          location: 'paris',
          temperature: 20,
          unit: 'C',
        },
      },
    ],
    userText: 'What is the weather in Paris?',
  },
  name: 'weather-paris',
  schemaVersion: 1,
  source: {
    realtimeModel: 'gpt-realtime-2.1-mini',
    text: 'What is the weather in Paris?',
  },
  trace: [
    {
      atMs: 0,
      direction: 'server',
      event: {
        delta: 'What is the weather in Paris?',
        item_id: 'user_item_1',
        type: 'conversation.item.input_audio_transcription.delta',
      },
    },
    {
      atMs: 350,
      direction: 'server',
      event: {
        arguments: '{"location":"Paris"}',
        call_id: 'call_1',
        name: 'getweather',
        type: 'response.function_call_arguments.done',
      },
    },
    {
      atMs: 351,
      direction: 'client',
      event: {
        item: {
          call_id: 'call_1',
          output:
            '{"location":"paris","conditions":"Sunny","humidity":58,"temperature":20,"unit":"C"}',
          type: 'function_call_output',
        },
        type: 'conversation.item.create',
      },
    },
    {
      atMs: 352,
      direction: 'client',
      event: { type: 'response.create' },
    },
    {
      atMs: 800,
      direction: 'server',
      event: {
        delta: 'It is sunny in Paris with a temperature of 20 degrees Celsius.',
        item_id: 'assistant_item_1',
        type: 'response.output_audio_transcript.delta',
      },
    },
  ],
} as const
const expectedToolCallLabels = ['Ran getweather'] as const

export const name = 'gpt-voice.fixture-weather-paris'

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
}
