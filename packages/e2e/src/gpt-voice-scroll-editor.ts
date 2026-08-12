import type { Test } from '@lvce-editor/test-with-playwright'

const content = Array.from(
  { length: 100 },
  (_, index) => `line ${index + 1}`,
).join('\n')

const fixture = {
  expect: {
    assistantText: 'I scrolled the editor down by 10 lines.',
    toolCalls: [
      {
        arguments: { direction: 'down', lineCount: 10 },
        name: 'scroll_editor',
        output: { direction: 'down', lineCount: 10, scrolled: true },
      },
    ],
    userText: 'Scroll the editor down by 10 lines.',
  },
  name: 'scroll-editor',
  schemaVersion: 1,
  source: {
    realtimeModel: 'gpt-realtime-2.1-mini',
    text: 'Scroll the editor down by 10 lines.',
  },
  trace: [
    {
      atMs: 0,
      direction: 'server',
      event: {
        delta: 'Scroll the editor down by 10 lines.',
        item_id: 'user_item_1',
        type: 'conversation.item.input_audio_transcription.delta',
      },
    },
    {
      atMs: 300,
      direction: 'server',
      event: {
        arguments: '{"direction":"down","lineCount":10}',
        call_id: 'scroll_editor_call_1',
        name: 'scroll_editor',
        type: 'response.function_call_arguments.done',
      },
    },
    {
      atMs: 301,
      direction: 'client',
      event: {
        item: {
          call_id: 'scroll_editor_call_1',
          output: '{"direction":"down","lineCount":10,"scrolled":true}',
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
        delta: 'I scrolled the editor down by 10 lines.',
        item_id: 'assistant_item_1',
        type: 'response.output_audio_transcript.delta',
      },
    },
  ],
} as const

export const name = 'gpt-voice.scroll-editor'

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
  const filePath = `${workspaceUri}/scroll-lines.txt`
  await FileSystem.writeFile(filePath, content)
  await Workspace.setPath(workspaceUri)
  await Main.closeAllEditors()
  await Main.openUri(filePath)

  const firstEditorRow = Locator('.EditorRow').nth(0)
  await expect(firstEditorRow).toHaveText('line 1')

  await Command.executeExtensionCommand('GptVoice.setIsTest')
  await SideBar.open('gpt-voice.views.default')
  await Command.executeExtensionCommand('GptVoice.replayFixture', fixture)

  const voice = Locator('.GptVoice')
  await expect(voice).toContainText('Ran scroll_editor')
  await expect(firstEditorRow).toHaveText('line 11')
}
