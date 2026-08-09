import type { Test } from '@lvce-editor/test-with-playwright'

const fixture = {
  expect: {
    assistantText: 'The devcontainer.json file is open.',
    toolCalls: [
      {
        arguments: {
          path: 'devcontainer.json',
        },
        name: 'open_workspace_file',
        output: {
          error: 'Workspace file "devcontainer.json" was not found.',
          hint: 'Pass an exact file path relative to the workspace, such as {"path":"src/index.ts"}. If the path is unknown or was not found, call search_workspace_files with the filename, then retry with a returned path.',
          tool: 'open_workspace_file',
        },
      },
      {
        arguments: {
          query: 'devcontainer.json',
        },
        name: 'search_workspace_files',
        output: {
          matches: ['.devcontainer/devcontainer.json'],
          query: 'devcontainer.json',
          truncated: false,
        },
      },
      {
        arguments: {
          path: '.devcontainer/devcontainer.json',
        },
        name: 'open_workspace_file',
        output: {
          opened: true,
          path: '.devcontainer/devcontainer.json',
        },
      },
    ],
    userText: 'Open devcontainer.json from the workspace.',
  },
  name: 'open-nested-workspace-file',
  schemaVersion: 1,
  source: {
    realtimeModel: 'gpt-realtime-2.1-mini',
    text: 'Open devcontainer.json from the workspace.',
  },
  trace: [
    {
      atMs: 0,
      direction: 'server',
      event: {
        delta: 'Open devcontainer.json from the workspace.',
        item_id: 'user_item_1',
        type: 'conversation.item.input_audio_transcription.delta',
      },
    },
    {
      atMs: 350,
      direction: 'server',
      event: {
        arguments: '{"path":"devcontainer.json"}',
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
          output:
            '{"error":"Workspace file \\"devcontainer.json\\" was not found.","hint":"Pass an exact file path relative to the workspace, such as {\\"path\\":\\"src/index.ts\\"}. If the path is unknown or was not found, call search_workspace_files with the filename, then retry with a returned path.","tool":"open_workspace_file"}',
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
        arguments: '{"query":"devcontainer.json"}',
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
            '{"matches":[".devcontainer/devcontainer.json"],"query":"devcontainer.json","truncated":false}',
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
        arguments: '{"path":".devcontainer/devcontainer.json"}',
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
          output: '{"opened":true,"path":".devcontainer/devcontainer.json"}',
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
        delta: 'The devcontainer.json file is open.',
        item_id: 'assistant_item_1',
        type: 'response.output_audio_transcript.delta',
      },
    },
  ],
} as const
const expectedToolCallLabels = [
  'Failed open_workspace_file',
  'Ran search_workspace_files',
  'Ran open_workspace_file',
] as const

export const name = 'gpt-voice.fixture-open-nested-workspace-file'

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
  await FileSystem.mkdir(workspaceUri + '/.devcontainer')
  await FileSystem.writeFile(
    workspaceUri + '/.devcontainer/devcontainer.json',
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
  await expect(editorTabTitle).toHaveText('devcontainer.json')
  await Editor.shouldHaveText('Voice fixture workspace file')
}
