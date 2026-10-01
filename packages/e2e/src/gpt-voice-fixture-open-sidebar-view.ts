import type { Test } from '@lvce-editor/test-with-playwright'

const fixture = {
  expect: {
    assistantText: 'The Explorer sidebar is open.',
    toolCalls: [
      {
        arguments: { view: 'Explorer' },
        name: 'open_sidebar_view',
        output: { opened: true, view: 'Explorer' },
      },
    ],
    userText: 'Open the Explorer in the sidebar.',
  },
  name: 'open-sidebar-view',
  schemaVersion: 1,
  source: {
    realtimeModel: 'gpt-realtime-2.1-mini',
    text: 'Open the Explorer in the sidebar.',
  },
  trace: [
    {
      atMs: 0,
      direction: 'server',
      event: {
        delta: 'Open the Explorer in the sidebar.',
        item_id: 'user_item_1',
        type: 'conversation.item.input_audio_transcription.delta',
      },
    },
    {
      atMs: 350,
      direction: 'server',
      event: {
        arguments: '{"view":"Explorer"}',
        call_id: 'call_1',
        name: 'open_sidebar_view',
        type: 'response.function_call_arguments.done',
      },
    },
    {
      atMs: 351,
      direction: 'client',
      event: {
        item: {
          call_id: 'call_1',
          output: '{"opened":true,"view":"Explorer"}',
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
        delta: 'The Explorer sidebar is open.',
        item_id: 'assistant_item_1',
        type: 'response.output_audio_transcript.delta',
      },
    },
  ],
} as const

export const name = 'gpt-voice.fixture-open-sidebar-view'

export const test: Test = async ({
  Command,
  expect,
  Locator,
  Settings,
  SideBar,
}) => {
  await Settings.update({ 'workbench.sideBarLocation': 'left' })
  await Command.executeExtensionCommand('GptVoice.setIsTest')
  await SideBar.open('gpt-voice.views.default')
  const voice = Locator('.GptVoice')

  await Command.execute('Layout.hideSideBar')
  await Command.executeExtensionCommand('GptVoice.replayFixture', fixture)

  if ((await Command.execute('Layout.getSideBarVisible')) !== true) {
    throw new Error('Expected the primary sidebar to be visible.')
  }
  if ((await Command.execute('Layout.getActiveSideBarView')) !== 'Explorer') {
    throw new Error('Expected the Explorer sidebar view to be active.')
  }
  await expect(voice).toContainText('Ran open_sidebar_view')

  await Command.executeExtensionCommand('GptVoice.replayFixture', fixture)
  if ((await Command.execute('Layout.getSideBarVisible')) !== true) {
    throw new Error('Expected the primary sidebar to remain visible.')
  }
  if ((await Command.execute('Layout.getActiveSideBarView')) !== 'Explorer') {
    throw new Error(
      'Expected repeated Explorer requests to keep Explorer active.',
    )
  }

  await Command.execute('Layout.showSideBar', 'Search')
  if ((await Command.execute('Layout.getActiveSideBarView')) !== 'Search') {
    throw new Error('Expected the Search sidebar view to be active.')
  }
  await Command.executeExtensionCommand('GptVoice.replayFixture', fixture)
  if ((await Command.execute('Layout.getActiveSideBarView')) !== 'Explorer') {
    throw new Error('Expected the Explorer sidebar view to be active again.')
  }
}
