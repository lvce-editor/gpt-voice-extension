import type { Test } from '@lvce-editor/test-with-playwright'

const fixture = {
  expect: {
    assistantText: 'Settings is the only open editor.',
    toolCalls: [
      {
        arguments: {},
        name: 'get_open_editor_tabs',
        output: {
          count: 1,
          tabs: [
            {
              title: 'settings',
              uri: 'settings://',
            },
          ],
        },
      },
    ],
    userText: 'Which editors are open?',
  },
  name: 'query-open-editors',
  schemaVersion: 1,
  source: {
    realtimeModel: 'gpt-realtime-2.1-mini',
    text: 'Which editors are open?',
  },
  trace: [
    {
      atMs: 0,
      direction: 'server',
      event: {
        delta: 'Which editors are open?',
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
        name: 'get_open_editor_tabs',
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
            '{"count":1,"tabs":[{"title":"settings","uri":"settings://"}]}',
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
      atMs: 800,
      direction: 'server',
      event: {
        delta: 'Settings is the only open editor.',
        item_id: 'assistant_item_1',
        type: 'response.output_audio_transcript.delta',
      },
    },
  ],
} as const

export const name = 'gpt-voice.fixture-query-open-editors'

export const test: Test = async ({
  Command,
  expect,
  Locator,
  Main,
  SideBar,
}) => {
  await Main.closeAllEditors()
  await Command.execute('Preferences.openSettingsUi')

  const editorTabs = Locator('.MainTab')
  await expect(editorTabs).toHaveCount(1)

  await Command.executeExtensionCommand('GptVoice.setIsTest')
  await SideBar.open('gpt-voice.views.default')
  await Command.executeExtensionCommand('GptVoice.replayFixture', fixture)

  await expect(editorTabs).toHaveCount(1)
  const voice = Locator('.GptVoice')
  const userTranscript = Locator('.GptVoiceTranscriptItemUser')
  const assistantTranscript = Locator('.GptVoiceTranscriptItemAi')
  await expect(voice).toContainText('Ran get_open_editor_tabs')
  await expect(userTranscript).toHaveText(fixture.expect.userText)
  await expect(assistantTranscript).toHaveText(fixture.expect.assistantText)
}
