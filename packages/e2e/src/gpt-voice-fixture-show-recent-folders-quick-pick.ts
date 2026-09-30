import type { Test } from '@lvce-editor/test-with-playwright'

const createFixture = () =>
  ({
    expect: {
      assistantText: 'The recently opened folders picker is open.',
      toolCalls: [
        {
          arguments: {},
          name: 'show_recent_folders_quick_pick',
          output: { shown: true },
        },
      ],
      userText: 'Show my recently opened folders.',
    },
    name: 'show-recent-folders-quick-pick',
    schemaVersion: 1,
    source: {
      realtimeModel: 'gpt-realtime-2.1-mini',
      text: 'Show my recently opened folders.',
    },
    trace: [
      {
        atMs: 0,
        direction: 'server',
        event: {
          delta: 'Show my recently opened folders.',
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
          name: 'show_recent_folders_quick_pick',
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
        event: { type: 'response.create' },
      },
      {
        atMs: 650,
        direction: 'server',
        event: {
          delta: 'The recently opened folders picker is open.',
          item_id: 'assistant_item_1',
          type: 'response.output_audio_transcript.delta',
        },
      },
    ],
  }) as const

const waitForWorkspaceUri = async (
  getWorkspaceUri: () => Promise<unknown>,
  expectedUri: string,
): Promise<void> => {
  let actualUri: unknown
  for (let attempt = 0; attempt < 10_000; attempt++) {
    actualUri = await getWorkspaceUri()
    if (actualUri === expectedUri) {
      return
    }
  }
  throw new Error(
    `Expected workspace ${expectedUri}, received ${String(actualUri)}`,
  )
}

export const name = 'gpt-voice.fixture-show-recent-folders-quick-pick'

export const test: Test = async ({
  Command,
  expect,
  FileSystem,
  Locator,
  QuickPick,
  SideBar,
  Workspace,
}) => {
  const tmpDir = await FileSystem.getTmpDir()
  const currentWorkspaceUri = `${tmpDir}/current-workspace`
  const recentWorkspaceUri = `${tmpDir}/about-view`
  await FileSystem.mkdir(currentWorkspaceUri)
  await FileSystem.mkdir(recentWorkspaceUri)
  await Workspace.setPath(currentWorkspaceUri)
  await Command.execute('RecentlyOpened.clearRecentlyOpened')
  await Command.execute(
    'RecentlyOpened.addToRecentlyOpened',
    recentWorkspaceUri,
  )
  const recentlyOpened = await Command.execute(
    'RecentlyOpened.getRecentlyOpened',
  )
  if (
    !Array.isArray(recentlyOpened) ||
    !recentlyOpened.includes(recentWorkspaceUri)
  ) {
    throw new Error(
      `Expected recent folder ${recentWorkspaceUri}, received ${JSON.stringify(recentlyOpened)}`,
    )
  }

  await Command.executeExtensionCommand('GptVoice.setIsTest')
  await SideBar.open('gpt-voice.views.default')
  const fixture = createFixture()
  await Command.executeExtensionCommand('GptVoice.replayFixture', fixture)

  const voice = Locator('.GptVoice')
  const userTranscript = Locator('.GptVoiceTranscriptItemUser')
  const assistantTranscript = Locator('.GptVoiceTranscriptItemAi')
  const quickPickInput = Locator('#QuickPick .InputBox')
  const recentFolder = Locator('.QuickPickItemLabel').nth(0)
  await expect(voice).toContainText('Ran show_recent_folders_quick_pick')
  await expect(userTranscript).toHaveText(fixture.expect.userText)
  await expect(assistantTranscript).toHaveText(fixture.expect.assistantText)
  await expect(quickPickInput).toBeVisible()
  await expect(recentFolder).toContainText('about-view')
  const currentUri = await Command.execute('Workspace.getUri')
  if (currentUri !== currentWorkspaceUri) {
    throw new Error(
      `Expected workspace ${currentWorkspaceUri}, received ${currentUri}`,
    )
  }

  await Command.execute('QuickPick.setValue', recentWorkspaceUri)
  await expect(recentFolder).toContainText('about-view')
  await QuickPick.selectItem(recentWorkspaceUri)
  await waitForWorkspaceUri(
    () => Command.execute('Workspace.getUri'),
    recentWorkspaceUri,
  )
}
