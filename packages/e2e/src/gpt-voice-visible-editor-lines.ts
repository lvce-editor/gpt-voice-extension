import type { Test } from '@lvce-editor/test-with-playwright'

const content = ['first', 'second', 'third', 'fourth', 'fifth'].join('\n')

const fixture = {
  expect: {
    assistantText: 'Lines 1 through 5 are visible.',
    toolCalls: [
      {
        arguments: {},
        name: 'get_visible_editor_lines',
        output: { endLine: 5, lineCount: 5, startLine: 1 },
      },
    ],
    userText: 'Which lines are visible in the editor?',
  },
  name: 'visible-editor-lines',
  schemaVersion: 1,
  source: {
    realtimeModel: 'gpt-realtime-2.1-mini',
    text: 'Which lines are visible in the editor?',
  },
  trace: [
    {
      atMs: 0,
      direction: 'server',
      event: {
        delta: 'Which lines are visible in the editor?',
        item_id: 'user_item_1',
        type: 'conversation.item.input_audio_transcription.delta',
      },
    },
    {
      atMs: 300,
      direction: 'server',
      event: {
        arguments: '{}',
        call_id: 'visible_lines_call_1',
        name: 'get_visible_editor_lines',
        type: 'response.function_call_arguments.done',
      },
    },
    {
      atMs: 301,
      direction: 'client',
      event: {
        item: {
          call_id: 'visible_lines_call_1',
          output: '{"endLine":5,"lineCount":5,"startLine":1}',
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
      atMs: 600,
      direction: 'server',
      event: {
        delta: 'Lines 1 through 5 are visible.',
        item_id: 'assistant_item_1',
        type: 'response.output_audio_transcript.delta',
      },
    },
  ],
} as const

export const name = 'gpt-voice.visible-editor-lines'

export const test: Test = async ({
  Command,
  expect,
  FileSystem,
  Locator,
  Main,
  SideBar,
  Workspace,
}) => {
  const workspaceUri = await FileSystem.getTmpDir()
  const filePath = `${workspaceUri}/visible-lines.txt`
  await FileSystem.writeFile(filePath, content)
  await Workspace.setPath(workspaceUri)
  await Main.closeAllEditors()
  await Main.openUri(filePath)

  await Command.executeExtensionCommand('GptVoice.setIsTest')
  await SideBar.open('gpt-voice.views.default')
  await Command.executeExtensionCommand('GptVoice.replayFixture', fixture)

  const voice = Locator('.GptVoice')
  const assistantTranscript = Locator('.GptVoiceTranscriptItemAi')
  await expect(voice).toContainText('Ran get_visible_editor_lines')
  await expect(assistantTranscript).toHaveText(fixture.expect.assistantText)
}
