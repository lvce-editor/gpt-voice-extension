import type { Test } from '@lvce-editor/test-with-playwright'

const fixture = {
  expect: {
    assistantText: 'Rename mode is open for the scripts folder.',
    toolCalls: [
      {
        arguments: {
          path: 'scripts',
        },
        name: 'start_explorer_rename',
        output: {
          path: 'scripts',
          renaming: true,
        },
      },
    ],
    userText: 'Rename the scripts folder in Explorer.',
  },
  name: 'start-explorer-rename',
  schemaVersion: 1,
  source: {
    realtimeModel: 'gpt-realtime-2.1-mini',
    text: 'Rename the scripts folder in Explorer.',
  },
  trace: [
    {
      atMs: 0,
      direction: 'server',
      event: {
        delta: 'Rename the scripts folder in Explorer.',
        item_id: 'user_item_1',
        type: 'conversation.item.input_audio_transcription.delta',
      },
    },
    {
      atMs: 350,
      direction: 'server',
      event: {
        arguments: '{"path":"scripts"}',
        call_id: 'call_1',
        name: 'start_explorer_rename',
        type: 'response.function_call_arguments.done',
      },
    },
    {
      atMs: 351,
      direction: 'client',
      event: {
        item: {
          call_id: 'call_1',
          output: '{"path":"scripts","renaming":true}',
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
        delta: 'Rename mode is open for the scripts folder.',
        item_id: 'assistant_item_1',
        type: 'response.output_audio_transcript.delta',
      },
    },
  ],
} as const
const expectedToolCallLabels = ['Ran start_explorer_rename'] as const

export const name = 'gpt-voice.fixture-start-explorer-rename'

export const test: Test = async ({
  Command,
  expect,
  FileSystem,
  Locator,
  SideBar,
  Workspace,
}) => {
  const explorerWorkspaceUri = await FileSystem.getTmpDir()
  await FileSystem.mkdir(explorerWorkspaceUri + '/scripts')
  await FileSystem.writeFile(
    explorerWorkspaceUri + '/scripts/voice-child.txt',
    'Explorer voice fixture',
  )
  await Workspace.setPath(explorerWorkspaceUri)
  await SideBar.open('Explorer')

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
  const explorerInput = Locator('.ExplorerInputBox')
  await expect(explorerInput).toBeVisible()
  await expect(explorerInput).toBeFocused()
  await expect(explorerInput).toHaveValue('scripts')
}
