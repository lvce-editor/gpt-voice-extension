import type { Test } from '@lvce-editor/test-with-playwright'

const fixture = {
  expect: {
    assistantText: 'The HTML preview is open.',
    toolCalls: [
      {
        arguments: {},
        name: 'open_html_preview',
        output: { opened: true },
      },
    ],
    userText: 'Show the preview for this HTML file.',
  },
  name: 'open-html-preview',
  schemaVersion: 1,
  source: {
    realtimeModel: 'gpt-realtime-2.1-mini',
    text: 'Show the preview for this HTML file.',
  },
  trace: [
    {
      atMs: 0,
      direction: 'server',
      event: {
        delta: 'Show the preview for this HTML file.',
        item_id: 'user_item_1',
        type: 'conversation.item.input_audio_transcription.delta',
      },
    },
    {
      atMs: 350,
      direction: 'server',
      event: {
        arguments: '{}',
        call_id: 'preview_call_1',
        name: 'open_html_preview',
        type: 'response.function_call_arguments.done',
      },
    },
    {
      atMs: 351,
      direction: 'client',
      event: {
        item: {
          call_id: 'preview_call_1',
          output: '{"opened":true}',
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
      atMs: 800,
      direction: 'server',
      event: {
        delta: 'The HTML preview is open.',
        item_id: 'assistant_item_1',
        type: 'response.output_audio_transcript.delta',
      },
    },
  ],
} as const

export const name = 'gpt-voice.open-html-preview'

export const test: Test = async ({
  Command,
  expect,
  FileSystem,
  Locator,
  Main,
  SideBar,
  Workspace,
}) => {
  await Main.closeAllEditors()
  const workspaceUri = await FileSystem.getTmpDir()
  const html =
    '<!doctype html><html><body><h1>Hello Voice Preview</h1></body></html>'
  const htmlUri = `${workspaceUri}/index.html`
  await FileSystem.writeFile(htmlUri, html)
  await Workspace.setPath(workspaceUri)
  await Main.openUri(htmlUri)
  await Command.executeExtensionCommand('GptVoice.setIsTest')
  await SideBar.open('gpt-voice.views.default')

  await Command.executeExtensionCommand('GptVoice.replayFixture', fixture)

  const previewCloseButton = Locator('.PreviewCloseButton')
  const voice = Locator('.GptVoice')
  const assistantTranscript = Locator('.GptVoiceTranscriptItemAi')
  await expect(previewCloseButton).toBeVisible()
  await expect(voice).toContainText('Ran open_html_preview')
  await expect(assistantTranscript).toHaveText(fixture.expect.assistantText)
}
