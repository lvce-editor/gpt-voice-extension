import type { Test } from '@lvce-editor/test-with-playwright'

const fixture = {
  expect: {
    assistantText: 'The project uses Node.js version 24.19.0.',
    toolCalls: [
      {
        arguments: {},
        name: 'list_workspace_directory',
        output: {
          entries: [
            {
              name: '.nvmrc',
              type: 'file',
            },
          ],
          path: '.',
        },
      },
      {
        arguments: {
          path: '.nvmrc',
        },
        name: 'read_workspace_file',
        output: {
          content: '24.19.0\n',
          path: '.nvmrc',
        },
      },
    ],
    userText: 'What Node version is this project on?',
  },
  name: 'node-version',
  schemaVersion: 1,
  source: {
    realtimeModel: 'gpt-realtime-2.1-mini',
    text: 'What Node version is this project on?',
  },
  trace: [
    {
      atMs: 0,
      direction: 'server',
      event: {
        delta: 'What Node version is this project on?',
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
        name: 'list_workspace_directory',
        type: 'response.function_call_arguments.done',
      },
    },
    {
      atMs: 351,
      direction: 'client',
      event: {
        item: {
          call_id: 'call_1',
          output: '{"entries":[{"name":".nvmrc","type":"file"}],"path":"."}',
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
        arguments: '{"path":".nvmrc"}',
        call_id: 'call_2',
        name: 'read_workspace_file',
        type: 'response.function_call_arguments.done',
      },
    },
    {
      atMs: 501,
      direction: 'client',
      event: {
        item: {
          call_id: 'call_2',
          output: '{"content":"24.19.0\\n","path":".nvmrc"}',
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
        delta: 'The project uses Node.js version 24.19.0.',
        item_id: 'assistant_item_1',
        type: 'response.output_audio_transcript.delta',
      },
    },
  ],
} as const
const expectedToolCallLabels = [
  'Ran list_workspace_directory',
  'Ran read_workspace_file',
] as const

export const name = 'gpt-voice.fixture-node-version'

export const test: Test = async ({
  Command,
  expect,
  FileSystem,
  Locator,
  SideBar,
  Workspace,
}) => {
  const workspaceUri = await FileSystem.getTmpDir()
  await FileSystem.writeFile(workspaceUri + '/.nvmrc', '24.19.0\n')
  await Workspace.setPath(workspaceUri)

  await Command.executeExtensionCommand('GptVoice.setIsTest')
  await SideBar.open('gpt-voice.views.default')

  await Command.executeExtensionCommand('GptVoice.replayFixture', fixture)

  const voice = Locator('.GptVoice')
  const userTranscript = Locator('.GptVoiceTranscriptItemUser')
  const assistantTranscript = Locator('.GptVoiceTranscriptItemAi')
  await expect(userTranscript).toHaveCount(1)
  await expect(userTranscript).toHaveText(fixture.source.text)
  for (const label of expectedToolCallLabels) {
    await expect(voice).toContainText(label)
  }
  await expect(assistantTranscript).toHaveText(fixture.expect.assistantText)
}
