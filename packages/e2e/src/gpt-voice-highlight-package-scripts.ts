import type { Test } from '@lvce-editor/test-with-playwright'

const packageJson = `{
  "name": "voice-selection-fixture",
  "scripts": {
    "build": "node build.js",
    "test": "node test.js"
  }
}`

const selections = [
  {
    endColumn: 4,
    endLine: 6,
    startColumn: 3,
    startLine: 3,
  },
] as const

const fixture = {
  expect: {
    assistantText:
      'The available scripts are build and test. I highlighted the scripts section in package.json.',
    toolCalls: [
      {
        arguments: { path: 'package.json' },
        name: 'read_workspace_file',
        output: { content: packageJson, path: 'package.json' },
      },
      {
        arguments: { path: 'package.json' },
        name: 'open_workspace_file',
        output: { opened: true, path: 'package.json' },
      },
      {
        arguments: { selections },
        name: 'set_editor_selections',
        output: { count: 1, selected: true, selections },
      },
    ],
    userText:
      'What scripts are available in package.json? Open the file and highlight the scripts section.',
  },
  name: 'highlight-package-scripts',
  schemaVersion: 1,
  source: {
    realtimeModel: 'gpt-realtime-2.1-mini',
    text: 'What scripts are available in package.json? Open the file and highlight the scripts section.',
  },
  trace: [
    {
      atMs: 0,
      direction: 'server',
      event: {
        delta:
          'What scripts are available in package.json? Open the file and highlight the scripts section.',
        item_id: 'user_item_1',
        type: 'conversation.item.input_audio_transcription.delta',
      },
    },
    {
      atMs: 300,
      direction: 'server',
      event: {
        arguments: '{"path":"package.json"}',
        call_id: 'read_call_1',
        name: 'read_workspace_file',
        type: 'response.function_call_arguments.done',
      },
    },
    {
      atMs: 301,
      direction: 'client',
      event: {
        item: {
          call_id: 'read_call_1',
          output: JSON.stringify({
            content: packageJson,
            path: 'package.json',
          }),
          type: 'function_call_output',
        },
        type: 'conversation.item.create',
      },
    },
    {
      atMs: 302,
      direction: 'client',
      event: { type: 'response.create' },
    },
    {
      atMs: 450,
      direction: 'server',
      event: {
        arguments: '{"path":"package.json"}',
        call_id: 'open_call_1',
        name: 'open_workspace_file',
        type: 'response.function_call_arguments.done',
      },
    },
    {
      atMs: 451,
      direction: 'client',
      event: {
        item: {
          call_id: 'open_call_1',
          output: '{"opened":true,"path":"package.json"}',
          type: 'function_call_output',
        },
        type: 'conversation.item.create',
      },
    },
    {
      atMs: 452,
      direction: 'client',
      event: { type: 'response.create' },
    },
    {
      atMs: 600,
      direction: 'server',
      event: {
        arguments: JSON.stringify({ selections }),
        call_id: 'selection_call_1',
        name: 'set_editor_selections',
        type: 'response.function_call_arguments.done',
      },
    },
    {
      atMs: 601,
      direction: 'client',
      event: {
        item: {
          call_id: 'selection_call_1',
          output: JSON.stringify({ count: 1, selected: true, selections }),
          type: 'function_call_output',
        },
        type: 'conversation.item.create',
      },
    },
    {
      atMs: 602,
      direction: 'client',
      event: { type: 'response.create' },
    },
    {
      atMs: 800,
      direction: 'server',
      event: {
        delta:
          'The available scripts are build and test. I highlighted the scripts section in package.json.',
        item_id: 'assistant_item_1',
        type: 'response.output_audio_transcript.delta',
      },
    },
  ],
} as const

export const name = 'gpt-voice.highlight-package-scripts'

export const test: Test = async ({
  Command,
  Editor,
  FileSystem,
  Main,
  SideBar,
  Workspace,
}) => {
  await Main.closeAllEditors()
  const workspaceUri = await FileSystem.getTmpDir()
  await FileSystem.writeFile(`${workspaceUri}/package.json`, packageJson)
  await Workspace.setPath(workspaceUri)

  await Command.executeExtensionCommand('GptVoice.setIsTest')
  await SideBar.open('gpt-voice.views.default')

  await Command.executeExtensionCommand('GptVoice.replayFixture', fixture)

  await Editor.shouldHaveText(packageJson)
  await Editor.shouldHaveSelections(new Uint32Array([2, 2, 5, 3]))
}
