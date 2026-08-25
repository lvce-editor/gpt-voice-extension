import type { Test } from '@lvce-editor/test-with-playwright'

const createFixture = (aboutViewUri: string) =>
  ({
    expect: {
      assistantText: 'The about-view workspace is open.',
      toolCalls: [
        {
          arguments: {},
          name: 'get_recently_opened_folders',
          output: {
            folders: [{ name: 'about-view', uri: aboutViewUri }],
          },
        },
        {
          arguments: { uri: aboutViewUri },
          name: 'open_workspace_folder',
          output: { opened: true, uri: aboutViewUri },
        },
      ],
      userText: 'Open about-view.',
    },
    name: 'open-recent-workspace',
    schemaVersion: 1,
    source: {
      realtimeModel: 'gpt-realtime-2.1-mini',
      text: 'Open about-view.',
    },
    trace: [
      {
        atMs: 0,
        direction: 'server',
        event: {
          delta: 'Open about-view.',
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
          name: 'get_recently_opened_folders',
          type: 'response.function_call_arguments.done',
        },
      },
      {
        atMs: 351,
        direction: 'client',
        event: {
          item: {
            call_id: 'call_1',
            output: JSON.stringify({
              folders: [{ name: 'about-view', uri: aboutViewUri }],
            }),
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
          arguments: JSON.stringify({ uri: aboutViewUri }),
          call_id: 'call_2',
          name: 'open_workspace_folder',
          type: 'response.function_call_arguments.done',
        },
      },
      {
        atMs: 651,
        direction: 'client',
        event: {
          item: {
            call_id: 'call_2',
            output: JSON.stringify({ opened: true, uri: aboutViewUri }),
            type: 'function_call_output',
          },
          type: 'conversation.item.create',
        },
      },
      {
        atMs: 652,
        direction: 'client',
        event: { type: 'response.create' },
      },
      {
        atMs: 900,
        direction: 'server',
        event: {
          delta: 'The about-view workspace is open.',
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

export const name = 'gpt-voice.fixture-open-recent-workspace'

export const test: Test = async ({
  Command,
  expect,
  FileSystem,
  Locator,
  SideBar,
  Workspace,
}) => {
  const tmpDir = await FileSystem.getTmpDir()
  const currentWorkspaceUri = `${tmpDir}/current-workspace`
  const aboutViewUri = `${tmpDir}/about-view`
  await FileSystem.mkdir(currentWorkspaceUri)
  await FileSystem.mkdir(aboutViewUri)
  await Workspace.setPath(currentWorkspaceUri)
  await Command.execute('RecentlyOpened.clearRecentlyOpened')
  await Command.execute('RecentlyOpened.addToRecentlyOpened', aboutViewUri)

  const fixture = createFixture(aboutViewUri)
  await Command.executeExtensionCommand('GptVoice.setIsTest')
  await SideBar.open('gpt-voice.views.default')
  await Command.executeExtensionCommand('GptVoice.replayFixture', fixture)

  const voice = Locator('.GptVoice')
  const userTranscript = Locator('.GptVoiceTranscriptItemUser')
  const assistantTranscript = Locator('.GptVoiceTranscriptItemAi')
  await expect(voice).toContainText('Ran get_recently_opened_folders')
  await expect(voice).toContainText('Ran open_workspace_folder')
  await waitForWorkspaceUri(
    () => Command.execute('Workspace.getUri'),
    aboutViewUri,
  )
  await expect(userTranscript).toHaveText(fixture.expect.userText)
  await expect(assistantTranscript).toHaveText(fixture.expect.assistantText)
}
