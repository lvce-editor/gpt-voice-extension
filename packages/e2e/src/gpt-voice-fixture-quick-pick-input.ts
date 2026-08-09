import type { Test } from '@lvce-editor/test-with-playwright'

const fixture = {
  expect: {
    assistantText: 'The file picker is filtered to ci.yaml.',
    toolCalls: [
      {
        arguments: {},
        name: 'show_file_quick_pick',
        output: {
          shown: true,
        },
      },
      {
        arguments: {
          value: 'ci.yaml',
        },
        name: 'set_quick_pick_value',
        output: {
          updated: true,
          value: 'ci.yaml',
        },
      },
    ],
    userText: 'Open the file picker and type ci.yaml.',
  },
  name: 'quick-pick-input',
  schemaVersion: 1,
  source: {
    realtimeModel: 'gpt-realtime-2.1-mini',
    text: 'Open the file picker and type ci.yaml.',
  },
  trace: [
    {
      atMs: 0,
      direction: 'server',
      event: {
        delta: 'Open the file picker and type ci.yaml.',
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
        name: 'show_file_quick_pick',
        type: 'response.function_call_arguments.done',
      },
    },
    {
      atMs: 351,
      direction: 'client',
      event: {
        item: {
          call_id: 'call_1',
          output: '{"shown":true}',
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
        arguments: '{"value":"ci.yaml"}',
        call_id: 'call_2',
        name: 'set_quick_pick_value',
        type: 'response.function_call_arguments.done',
      },
    },
    {
      atMs: 501,
      direction: 'client',
      event: {
        item: {
          call_id: 'call_2',
          output: '{"updated":true,"value":"ci.yaml"}',
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
        delta: 'The file picker is filtered to ci.yaml.',
        item_id: 'assistant_item_1',
        type: 'response.output_audio_transcript.delta',
      },
    },
  ],
} as const

const expectedToolCallLabels = [
  'Ran show_file_quick_pick',
  'Ran set_quick_pick_value',
] as const

export const name = 'gpt-voice.fixture-quick-pick-input'

export const test: Test = async ({
  Command,
  expect,
  FileSystem,
  Locator,
  SideBar,
  Workspace,
}) => {
  const workspaceUri = await FileSystem.getTmpDir()
  await FileSystem.setFiles([
    { content: 'name: CI', uri: workspaceUri + '/ci.yaml' },
    { content: '# Workspace', uri: workspaceUri + '/README.md' },
  ])
  await Workspace.setPath(workspaceUri)

  await Command.executeExtensionCommand('GptVoice.setIsTest')
  await SideBar.open('gpt-voice.views.default')

  await Command.executeExtensionCommand('GptVoice.replayFixture', fixture)

  const voice = Locator('.GptVoice')
  const quickPickInput = Locator('#QuickPick .InputBox')
  const firstQuickPickItem = Locator('.QuickPickItemLabel').nth(0)
  const userTranscript = Locator('.GptVoiceTranscriptItemUser')
  const assistantTranscript = Locator('.GptVoiceTranscriptItemAi')
  await expect(userTranscript).toHaveText(fixture.expect.userText)
  for (const label of expectedToolCallLabels) {
    await expect(voice).toContainText(label)
  }
  await expect(assistantTranscript).toHaveText(fixture.expect.assistantText)
  await expect(quickPickInput).toBeVisible()
  await expect(quickPickInput).toHaveValue('ci.yaml')
  await expect(firstQuickPickItem).toHaveText('ci.yaml')
}
