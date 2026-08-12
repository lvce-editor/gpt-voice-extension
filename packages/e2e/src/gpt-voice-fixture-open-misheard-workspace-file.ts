import type { Test } from '@lvce-editor/test-with-playwright'

const fixture = {
  expect: {
    assistantText: 'I opened style.css. The filename was singular.',
    toolCalls: [
      {
        arguments: {
          query: 'styles.css',
        },
        name: 'search_workspace_files',
        output: {
          hint: 'No files matched. Double-check whether the filename was heard or read correctly, then search again with a likely correction or a shorter distinctive part of the filename before giving up.',
          matches: [],
          query: 'styles.css',
          truncated: false,
        },
      },
      {
        arguments: {
          query: 'style.css',
        },
        name: 'search_workspace_files',
        output: {
          matches: ['style.css'],
          query: 'style.css',
          truncated: false,
        },
      },
      {
        arguments: {
          path: 'style.css',
        },
        name: 'open_workspace_file',
        output: {
          opened: true,
          path: 'style.css',
        },
      },
    ],
    userText: 'Open styles.css.',
  },
  name: 'open-misheard-workspace-file',
  schemaVersion: 1,
  source: {
    realtimeModel: 'gpt-realtime-2.1-mini',
    text: 'Open styles.css.',
  },
  trace: [
    {
      atMs: 0,
      direction: 'server',
      event: {
        delta: 'Open styles.css.',
        item_id: 'user_item_1',
        type: 'conversation.item.input_audio_transcription.delta',
      },
    },
    {
      atMs: 350,
      direction: 'server',
      event: {
        arguments: '{"query":"styles.css"}',
        call_id: 'call_1',
        name: 'search_workspace_files',
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
            '{"hint":"No files matched. Double-check whether the filename was heard or read correctly, then search again with a likely correction or a shorter distinctive part of the filename before giving up.","matches":[],"query":"styles.css","truncated":false}',
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
      atMs: 650,
      direction: 'server',
      event: {
        arguments: '{"query":"style.css"}',
        call_id: 'call_2',
        name: 'search_workspace_files',
        type: 'response.function_call_arguments.done',
      },
    },
    {
      atMs: 651,
      direction: 'client',
      event: {
        item: {
          call_id: 'call_2',
          output:
            '{"matches":["style.css"],"query":"style.css","truncated":false}',
          type: 'function_call_output',
        },
        type: 'conversation.item.create',
      },
    },
    {
      atMs: 652,
      direction: 'client',
      event: {
        type: 'response.create',
      },
    },
    {
      atMs: 950,
      direction: 'server',
      event: {
        arguments: '{"path":"style.css"}',
        call_id: 'call_3',
        name: 'open_workspace_file',
        type: 'response.function_call_arguments.done',
      },
    },
    {
      atMs: 951,
      direction: 'client',
      event: {
        item: {
          call_id: 'call_3',
          output: '{"opened":true,"path":"style.css"}',
          type: 'function_call_output',
        },
        type: 'conversation.item.create',
      },
    },
    {
      atMs: 952,
      direction: 'client',
      event: {
        type: 'response.create',
      },
    },
    {
      atMs: 1200,
      direction: 'server',
      event: {
        delta: 'I opened style.css. The filename was singular.',
        item_id: 'assistant_item_1',
        type: 'response.output_audio_transcript.delta',
      },
    },
  ],
} as const
const expectedToolCallLabels = [
  'Ran search_workspace_files',
  'Ran search_workspace_files',
  'Ran open_workspace_file',
] as const

export const name = 'gpt-voice.fixture-open-misheard-workspace-file'

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
    workspaceUri + '/style.css',
    'Voice fixture workspace file',
  )
  await Workspace.setPath(workspaceUri)

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
  const editorTabTitle = Locator('.MainTab .TabTitle')
  await expect(editorTabTitle).toHaveText('style.css')
  await Editor.shouldHaveText('Voice fixture workspace file')
}
