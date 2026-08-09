import type { Test } from '@lvce-editor/test-with-playwright'

const fixture = {
  expect: {
    assistantText: 'The document is formatted.',
    toolCalls: [
      {
        arguments: {},
        name: 'format_document',
        output: { formatted: true },
      },
    ],
    userText: 'Format document.',
  },
  name: 'format-document',
  schemaVersion: 1,
  source: {
    realtimeModel: 'gpt-realtime-2.1-mini',
    text: 'Format document.',
  },
  trace: [
    {
      atMs: 0,
      direction: 'server',
      event: {
        delta: 'Format document.',
        item_id: 'user_item_1',
        type: 'conversation.item.input_audio_transcription.delta',
      },
    },
    {
      atMs: 350,
      direction: 'server',
      event: {
        arguments: '{}',
        call_id: 'format_call_1',
        name: 'format_document',
        type: 'response.function_call_arguments.done',
      },
    },
    {
      atMs: 351,
      direction: 'client',
      event: {
        item: {
          call_id: 'format_call_1',
          output: '{"formatted":true}',
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
        delta: 'The document is formatted.',
        item_id: 'assistant_item_1',
        type: 'response.output_audio_transcript.delta',
      },
    },
  ],
} as const

export const name = 'gpt-voice.format-document'

export const test: Test = async ({
  Command,
  Editor,
  Extension,
  FileSystem,
  Main,
  SideBar,
  Workspace,
}) => {
  const formatterUri = import.meta
    .resolve('../fixtures/format-document/formatter')
  await Extension.addWebExtension(formatterUri)
  const tmpDir = await FileSystem.getTmpDir()
  await FileSystem.writeFile(`${tmpDir}/test.xyz`, 'const value=1')
  await Workspace.setPath(tmpDir)
  await Main.openUri(`${tmpDir}/test.xyz`)
  await Command.executeExtensionCommand('GptVoice.setIsTest')
  await SideBar.open('gpt-voice.views.default')

  await Command.executeExtensionCommand('GptVoice.replayFixture', fixture)

  await Editor.shouldHaveText('const value = 1')
}
