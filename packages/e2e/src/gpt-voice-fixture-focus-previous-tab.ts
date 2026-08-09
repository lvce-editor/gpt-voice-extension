import type { Test } from '@lvce-editor/test-with-playwright'

const fixture = {
  expect: {
    assistantText: 'The previous tab is focused.',
    toolCalls: [
      {
        arguments: {},
        name: 'focus_previous_tab',
        output: {
          focused: true,
        },
      },
    ],
    userText: 'Focus the previous tab.',
  },
  name: 'focus-previous-tab',
  schemaVersion: 1,
  source: {
    realtimeModel: 'gpt-realtime-2.1-mini',
    text: 'Focus the previous tab.',
  },
  trace: [
    {
      atMs: 0,
      direction: 'server',
      event: {
        delta: 'Focus the previous tab.',
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
        name: 'focus_previous_tab',
        type: 'response.function_call_arguments.done',
      },
    },
    {
      atMs: 351,
      direction: 'client',
      event: {
        item: {
          call_id: 'call_1',
          output: '{"focused":true}',
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
        delta: 'The previous tab is focused.',
        item_id: 'assistant_item_1',
        type: 'response.output_audio_transcript.delta',
      },
    },
  ],
} as const

export const name = 'gpt-voice.fixture-focus-previous-tab'

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
  const files = [
    `${tmpDir}/focus-previous-1.txt`,
    `${tmpDir}/focus-previous-2.txt`,
    `${tmpDir}/focus-previous-3.txt`,
  ]
  await FileSystem.setFiles(
    files.map((uri, index) => ({ content: `tab ${index + 1}`, uri })),
  )
  for (const file of files) {
    await Main.openUri(file)
  }

  const initiallySelectedTab = Locator(
    '.MainTabSelected[title$="focus-previous-3.txt"]',
  )
  await expect(initiallySelectedTab).toBeVisible()
  await Command.executeExtensionCommand('GptVoice.setIsTest')
  await SideBar.open('gpt-voice.views.default')

  await Command.executeExtensionCommand('GptVoice.replayFixture', fixture)

  const selectedTab = Locator('.MainTabSelected[title$="focus-previous-2.txt"]')
  const userTranscript = Locator('.GptVoiceTranscriptItemUser')
  const voice = Locator('.GptVoice')
  const assistantTranscript = Locator('.GptVoiceTranscriptItemAi')
  await expect(selectedTab).toBeVisible()
  await expect(userTranscript).toHaveText(fixture.expect.userText)
  await expect(voice).toContainText('Ran focus_previous_tab')
  await expect(assistantTranscript).toHaveText(fixture.expect.assistantText)
}
