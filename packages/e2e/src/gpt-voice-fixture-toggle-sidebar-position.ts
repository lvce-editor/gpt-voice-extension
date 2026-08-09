import type { Test } from '@lvce-editor/test-with-playwright'

const fixture = {
  expect: {
    assistantText: 'The sidebar is now on the left.',
    toolCalls: [
      {
        arguments: {},
        name: 'toggle_sidebar_position',
        output: {
          toggled: true,
        },
      },
    ],
    userText: 'Move the sidebar to the left.',
  },
  name: 'toggle-sidebar-position',
  schemaVersion: 1,
  source: {
    realtimeModel: 'gpt-realtime-2.1-mini',
    text: 'Move the sidebar to the left.',
  },
  trace: [
    {
      atMs: 0,
      direction: 'server',
      event: {
        delta: 'Move the sidebar to the left.',
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
        name: 'toggle_sidebar_position',
        type: 'response.function_call_arguments.done',
      },
    },
    {
      atMs: 351,
      direction: 'client',
      event: {
        item: {
          call_id: 'call_1',
          output: '{"toggled":true}',
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
        delta: 'The sidebar is now on the left.',
        item_id: 'assistant_item_1',
        type: 'response.output_audio_transcript.delta',
      },
    },
  ],
} as const

export const name = 'gpt-voice.fixture-toggle-sidebar-position'

export const test: Test = async ({
  Command,
  expect,
  Locator,
  Settings,
  SideBar,
}) => {
  await Settings.update({ 'workbench.sideBarLocation': 'right' })
  await Command.executeExtensionCommand('GptVoice.setIsTest')
  await SideBar.open('gpt-voice.views.default')

  const rightSideBar = Locator('.ContentArea > .SideBar + .ActivityBar')
  await expect(rightSideBar).toBeVisible()

  await Command.executeExtensionCommand('GptVoice.replayFixture', fixture)

  const leftSideBar = Locator('.ContentArea > .ActivityBar + .SideBar')
  const voice = Locator('.GptVoice')
  const userTranscript = Locator('.GptVoiceTranscriptItemUser')
  const assistantTranscript = Locator('.GptVoiceTranscriptItemAi')
  await expect(leftSideBar).toBeVisible()
  await expect(userTranscript).toHaveText(fixture.expect.userText)
  await expect(voice).toContainText('Ran toggle_sidebar_position')
  await expect(assistantTranscript).toHaveText(fixture.expect.assistantText)
}
