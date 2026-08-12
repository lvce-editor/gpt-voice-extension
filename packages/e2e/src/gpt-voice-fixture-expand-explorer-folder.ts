import type { Test } from '@lvce-editor/test-with-playwright'

const fixture = {
  expect: {
    assistantText: 'The scripts folder is expanded in Explorer.',
    toolCalls: [
      {
        arguments: {
          path: 'scripts',
        },
        name: 'expand_explorer_folder',
        output: {
          expanded: true,
          path: 'scripts',
        },
      },
    ],
    userText: 'Open the scripts folder in Explorer.',
  },
  name: 'expand-explorer-folder',
  schemaVersion: 1,
  source: {
    realtimeModel: 'gpt-realtime-2.1-mini',
    text: 'Open the scripts folder in Explorer.',
  },
  trace: [
    {
      atMs: 0,
      direction: 'server',
      event: {
        delta: 'Open the scripts folder in Explorer.',
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
        name: 'expand_explorer_folder',
        type: 'response.function_call_arguments.done',
      },
    },
    {
      atMs: 351,
      direction: 'client',
      event: {
        item: {
          call_id: 'call_1',
          output: '{"expanded":true,"path":"scripts"}',
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
        delta: 'The scripts folder is expanded in Explorer.',
        item_id: 'assistant_item_1',
        type: 'response.output_audio_transcript.delta',
      },
    },
  ],
} as const
const expectedToolCallLabels = ['Ran expand_explorer_folder'] as const

export const name = 'gpt-voice.fixture-expand-explorer-folder'

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
  const explorerItem = Locator('.Explorer .TreeItem[aria-label="scripts"]')
  const explorerChild = Locator(
    '.Explorer .TreeItem[aria-label="voice-child.txt"]',
  )
  await expect(explorerItem).toHaveAttribute('aria-expanded', 'true')
  await expect(explorerChild).toBeVisible()
}
