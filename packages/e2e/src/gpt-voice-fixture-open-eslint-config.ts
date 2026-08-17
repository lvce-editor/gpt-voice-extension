import type { Test } from '@lvce-editor/test-with-playwright'

const noMatchesHint =
  'No files matched. Double-check whether the filename was heard or read correctly, then search again with a likely correction or a shorter distinctive part of the filename before giving up. If the user asked for the ESLint config, search for "eslint.config.js", the modern flat-config filename.'

const fixture = {
  expect: {
    assistantText: 'I opened eslint.config.js.',
    toolCalls: [
      {
        arguments: { query: 'eslintrc' },
        name: 'search_workspace_files',
        output: {
          hint: noMatchesHint,
          matches: [],
          query: 'eslintrc',
          truncated: false,
        },
      },
      {
        arguments: { query: 'eslint.config.js' },
        name: 'search_workspace_files',
        output: {
          matches: ['eslint.config.js'],
          query: 'eslint.config.js',
          truncated: false,
        },
      },
      {
        arguments: { path: 'eslint.config.js' },
        name: 'open_workspace_file',
        output: { opened: true, path: 'eslint.config.js' },
      },
    ],
    userText: 'Open the ESLint config.',
  },
  name: 'open-eslint-config',
  schemaVersion: 1,
  source: {
    realtimeModel: 'gpt-realtime-2.1-mini',
    text: 'Open the ESLint config.',
  },
  trace: [
    {
      atMs: 0,
      direction: 'server',
      event: {
        delta: 'Open the ESLint config.',
        item_id: 'user_item_1',
        type: 'conversation.item.input_audio_transcription.delta',
      },
    },
    {
      atMs: 350,
      direction: 'server',
      event: {
        arguments: '{"query":"eslintrc"}',
        call_id: 'call_1',
        name: 'search_workspace_files',
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
            hint: noMatchesHint,
            matches: [],
            query: 'eslintrc',
            truncated: false,
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
        arguments: '{"query":"eslint.config.js"}',
        call_id: 'call_2',
        name: 'search_workspace_files',
        type: 'response.function_call_arguments.done',
      },
    },
    {
      atMs: 651,
      direction: 'client',
      event: {
        item: {
          call_id: 'call_2',
          output:
            '{"matches":["eslint.config.js"],"query":"eslint.config.js","truncated":false}',
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
      atMs: 950,
      direction: 'server',
      event: {
        arguments: '{"path":"eslint.config.js"}',
        call_id: 'call_3',
        name: 'open_workspace_file',
        type: 'response.function_call_arguments.done',
      },
    },
    {
      atMs: 951,
      direction: 'client',
      event: {
        item: {
          call_id: 'call_3',
          output: '{"opened":true,"path":"eslint.config.js"}',
          type: 'function_call_output',
        },
        type: 'conversation.item.create',
      },
    },
    {
      atMs: 952,
      direction: 'client',
      event: { type: 'response.create' },
    },
    {
      atMs: 1200,
      direction: 'server',
      event: {
        delta: 'I opened eslint.config.js.',
        item_id: 'assistant_item_1',
        type: 'response.output_audio_transcript.delta',
      },
    },
  ],
} as const

export const name = 'gpt-voice.fixture-open-eslint-config'

export const test: Test = async ({
  Command,
  Editor,
  expect,
  FileSystem,
  Locator,
  Main,
  SideBar,
  Workspace,
}) => {
  await Main.closeAllEditors()
  const workspaceUri = await FileSystem.getTmpDir()
  await FileSystem.writeFile(
    workspaceUri + '/eslint.config.js',
    'export default []',
  )
  await Workspace.setPath(workspaceUri)

  await Command.executeExtensionCommand('GptVoice.setIsTest')
  await SideBar.open('gpt-voice.views.default')
  await Command.executeExtensionCommand('GptVoice.replayFixture', fixture)

  const voice = Locator('.GptVoice')
  const userTranscript = Locator('.GptVoiceTranscriptItemUser')
  const assistantTranscript = Locator('.GptVoiceTranscriptItemAi')
  await expect(userTranscript).toHaveText(fixture.expect.userText)
  await expect(voice).toContainText('Ran search_workspace_files')
  await expect(voice).toContainText('Ran open_workspace_file')
  await expect(assistantTranscript).toHaveText(fixture.expect.assistantText)
  const editorTabTitle = Locator('.MainTab .TabTitle')
  await expect(editorTabTitle).toHaveText('eslint.config.js')
  await Editor.shouldHaveText('export default []')
}
