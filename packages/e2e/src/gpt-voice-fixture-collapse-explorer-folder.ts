import type { Test } from '@lvce-editor/test-with-playwright'

const fixture = {
  expect: {
    assistantText: 'The scripts folder is collapsed in Explorer.',
    toolCalls: [
      {
        arguments: {
          path: 'scripts',
        },
        name: 'collapse_explorer_folder',
        output: {
          collapsed: true,
          path: 'scripts',
        },
      },
    ],
    userText: 'Close the scripts folder in Explorer.',
  },
  name: 'collapse-explorer-folder',
  schemaVersion: 1,
  source: {
    realtimeModel: 'gpt-realtime-2.1-mini',
    text: 'Close the scripts folder in Explorer.',
  },
  trace: [
    {
      atMs: 0,
      direction: 'server',
      event: {
        delta: 'Close the scripts folder in Explorer.',
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
        name: 'collapse_explorer_folder',
        type: 'response.function_call_arguments.done',
      },
    },
    {
      atMs: 351,
      direction: 'client',
      event: {
        item: {
          call_id: 'call_1',
          output: '{"collapsed":true,"path":"scripts"}',
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
        delta: 'The scripts folder is collapsed in Explorer.',
        item_id: 'assistant_item_1',
        type: 'response.output_audio_transcript.delta',
      },
    },
  ],
} as const
const expectedToolCallLabels = ['Ran collapse_explorer_folder'] as const

export const name = 'gpt-voice.fixture-collapse-explorer-folder'

export const test: Test = async ({
  Command,
  expect,
  Explorer,
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
  await Explorer.handleClick(0)

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
  const explorerItem = Locator('.Explorer .TreeItem[aria-label="scripts"]')
  const explorerChild = Locator(
    '.Explorer .TreeItem[aria-label="voice-child.txt"]',
  )
  await expect(explorerItem).toHaveAttribute('aria-expanded', 'false')
  await expect(explorerChild).toHaveCount(0)
}
