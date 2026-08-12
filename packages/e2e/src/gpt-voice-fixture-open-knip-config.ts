import type { Test } from '@lvce-editor/test-with-playwright'

const fixture = {
  expect: {
    assistantText: 'The knip.json file is open.',
    toolCalls: [
      {
        arguments: {
          path: 'knip.json',
        },
        name: 'open_workspace_file',
        output: {
          opened: true,
          path: 'knip.json',
        },
      },
    ],
    userText: 'Open knip.json.',
  },
  name: 'open-knip-config',
  schemaVersion: 1,
  source: {
    realtimeModel: 'gpt-realtime-2.1-mini',
    text: 'Open knip.json.',
  },
  trace: [
    {
      atMs: 0,
      direction: 'server',
      event: {
        delta: 'Open knip.json.',
        item_id: 'user_item_1',
        type: 'conversation.item.input_audio_transcription.delta',
      },
    },
    {
      atMs: 350,
      direction: 'server',
      event: {
        arguments: '{"path":"knip.json"}',
        call_id: 'call_1',
        name: 'open_workspace_file',
        type: 'response.function_call_arguments.done',
      },
    },
    {
      atMs: 351,
      direction: 'client',
      event: {
        item: {
          call_id: 'call_1',
          output: '{"opened":true,"path":"knip.json"}',
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
        delta: 'The knip.json file is open.',
        item_id: 'assistant_item_1',
        type: 'response.output_audio_transcript.delta',
      },
    },
  ],
} as const

export const name = 'gpt-voice.fixture-open-knip-config'

export const test: Test = async ({
  Command,
  Editor,
  expect,
  FileSystem,
  Locator,
  Main,
  SideBar,
  Workspace,
}) => {
  await Main.closeAllEditors()
  const workspaceUri = await FileSystem.getTmpDir()
  await FileSystem.writeFile(
    workspaceUri + '/knip.json',
    '{"name":"gpt-voice-extension"}',
  )
  await Workspace.setPath(workspaceUri)

  await Command.executeExtensionCommand('GptVoice.setIsTest')
  await SideBar.open('gpt-voice.views.default')

  await Command.executeExtensionCommand('GptVoice.replayFixture', fixture)

  const voice = Locator('.GptVoice')
  const userTranscript = Locator('.GptVoiceTranscriptItemUser')
  const assistantTranscript = Locator('.GptVoiceTranscriptItemAi')
  await expect(userTranscript).toHaveText(fixture.expect.userText)
  await expect(voice).toContainText('Ran open_workspace_file')
  await expect(assistantTranscript).toHaveText(fixture.expect.assistantText)
  const editorTabTitle = Locator('.MainTab .TabTitle')
  await expect(editorTabTitle).toHaveText('knip.json')
  await Editor.shouldHaveText('{"name":"gpt-voice-extension"}')
}
