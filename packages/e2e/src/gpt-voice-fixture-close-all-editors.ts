import type { Test } from '@lvce-editor/test-with-playwright'

const fixture = {
  expect: {
    assistantText: 'All editors are closed.',
    toolCalls: [
      {
        arguments: {},
        name: 'close_all_editors',
        output: {
          closed: 2,
        },
      },
    ],
    userText: 'Close all editors.',
  },
  name: 'close-all-editors',
  schemaVersion: 1,
  source: {
    realtimeModel: 'gpt-realtime-2.1-mini',
    text: 'Close all editors.',
  },
  trace: [
    {
      atMs: 0,
      direction: 'server',
      event: {
        delta: 'Close all editors.',
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
        name: 'close_all_editors',
        type: 'response.function_call_arguments.done',
      },
    },
    {
      atMs: 351,
      direction: 'client',
      event: {
        item: {
          call_id: 'call_1',
          output: '{"closed":2}',
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
        delta: 'All editors are closed.',
        item_id: 'assistant_item_1',
        type: 'response.output_audio_transcript.delta',
      },
    },
  ],
} as const

export const name = 'gpt-voice.fixture-close-all-editors'

export const test: Test = async ({
  Command,
  expect,
  FileSystem,
  Locator,
  Main,
  SideBar,
}) => {
  await Main.closeAllEditors()
  const tmpDir = await FileSystem.getTmpDir()
  const firstFile = `${tmpDir}/first.txt`
  const secondFile = `${tmpDir}/second.txt`
  await FileSystem.setFiles([
    { content: 'first', uri: firstFile },
    { content: 'second', uri: secondFile },
  ])
  await Main.openUri(firstFile)
  await Main.openUri(secondFile)

  const editorTabs = Locator('.MainTab')
  await expect(editorTabs).toHaveCount(2)

  await Command.executeExtensionCommand('GptVoice.setIsTest')
  await SideBar.open('gpt-voice.views.default')
  await Command.executeExtensionCommand('GptVoice.replayFixture', fixture)

  await expect(editorTabs).toHaveCount(0)
  const voice = Locator('.GptVoice')
  const userTranscript = Locator('.GptVoiceTranscriptItemUser')
  const assistantTranscript = Locator('.GptVoiceTranscriptItemAi')
  await expect(voice).toContainText('Ran close_all_editors')
  await expect(userTranscript).toHaveText(fixture.expect.userText)
  await expect(assistantTranscript).toHaveText(fixture.expect.assistantText)
}
