import type { Test } from '@lvce-editor/test-with-playwright'

const fixture = {
  expect: {
    assistantText: 'The secondary sidebar is hidden.',
    toolCalls: [
      {
        arguments: {},
        name: 'hide_secondary_sidebar',
        output: {
          hidden: true,
        },
      },
    ],
    userText: 'Hide the secondary sidebar.',
  },
  name: 'hide-secondary-sidebar',
  schemaVersion: 1,
  source: {
    realtimeModel: 'gpt-realtime-2.1-mini',
    text: 'Hide the secondary sidebar.',
  },
  trace: [
    {
      atMs: 0,
      direction: 'server',
      event: {
        delta: 'Hide the secondary sidebar.',
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
        name: 'hide_secondary_sidebar',
        type: 'response.function_call_arguments.done',
      },
    },
    {
      atMs: 351,
      direction: 'client',
      event: {
        item: {
          call_id: 'call_1',
          output: '{"hidden":true}',
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
        delta: 'The secondary sidebar is hidden.',
        item_id: 'assistant_item_1',
        type: 'response.output_audio_transcript.delta',
      },
    },
  ],
} as const

export const name = 'gpt-voice.fixture-hide-secondary-sidebar'

export const test: Test = async ({
  Command,
  expect,
  Locator,
  Settings,
  SideBar,
}) => {
  await Settings.update({ 'workbench.sideBarLocation': 'right' })
  await Command.execute('Layout.showSideBar')
  await Command.execute('Layout.showSecondarySideBar')
  await SideBar.open('gpt-voice.views.default')

  const secondarySideBar = Locator('.SecondarySideBar')
  const primarySideBar = Locator('.ContentArea > .SideBar + .ActivityBar')
  await expect(secondarySideBar).toBeVisible()
  await expect(primarySideBar).toBeVisible()

  await Command.executeExtensionCommand('GptVoice.setIsTest')
  await Command.executeExtensionCommand('GptVoice.replayFixture', fixture)

  await expect(secondarySideBar).toBeHidden()
  await expect(primarySideBar).toBeVisible()
}
