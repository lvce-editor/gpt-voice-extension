import type { Test } from '@lvce-editor/test-with-playwright'

const fixture = {
  expect: {
    assistantText: 'The sidebar is closed.',
    toolCalls: [
      {
        arguments: {},
        name: 'close_sidebar',
        output: {
          closed: true,
        },
      },
    ],
    userText: 'Close the sidebar.',
  },
  name: 'close-sidebar',
  schemaVersion: 1,
  source: {
    realtimeModel: 'gpt-realtime-2.1-mini',
    text: 'Close the sidebar.',
  },
  trace: [
    {
      atMs: 0,
      direction: 'server',
      event: {
        delta: 'Close the sidebar.',
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
        name: 'close_sidebar',
        type: 'response.function_call_arguments.done',
      },
    },
    {
      atMs: 351,
      direction: 'client',
      event: {
        item: {
          call_id: 'call_1',
          output: '{"closed":true}',
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
        delta: 'The sidebar is closed.',
        item_id: 'assistant_item_1',
        type: 'response.output_audio_transcript.delta',
      },
    },
  ],
} as const

export const name = 'gpt-voice.fixture-close-sidebar'

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

  await expect(rightSideBar).toBeHidden()
  await Command.execute('Layout.showSideBar')
  await SideBar.open('gpt-voice.views.default')

  const leftSideBar = Locator('.ContentArea > .ActivityBar + .SideBar')
  await expect(rightSideBar).toBeVisible()
  await expect(leftSideBar).toBeHidden()
}
