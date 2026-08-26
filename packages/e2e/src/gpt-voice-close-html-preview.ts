import type { Test } from '@lvce-editor/test-with-playwright'

const fixture = {
  expect: {
    assistantText: 'The HTML preview is closed.',
    toolCalls: [
      {
        arguments: {},
        name: 'close_html_preview',
        output: { closed: true },
      },
    ],
    userText: 'Close the HTML preview.',
  },
  name: 'close-html-preview',
  schemaVersion: 1,
  source: {
    realtimeModel: 'gpt-realtime-2.1-mini',
    text: 'Close the HTML preview.',
  },
  trace: [
    {
      atMs: 0,
      direction: 'server',
      event: {
        delta: 'Close the HTML preview.',
        item_id: 'user_item_1',
        type: 'conversation.item.input_audio_transcription.delta',
      },
    },
    {
      atMs: 350,
      direction: 'server',
      event: {
        arguments: '{}',
        call_id: 'preview_close_call_1',
        name: 'close_html_preview',
        type: 'response.function_call_arguments.done',
      },
    },
    {
      atMs: 351,
      direction: 'client',
      event: {
        item: {
          call_id: 'preview_close_call_1',
          output: '{"closed":true}',
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
        delta: 'The HTML preview is closed.',
        item_id: 'assistant_item_1',
        type: 'response.output_audio_transcript.delta',
      },
    },
  ],
} as const

export const name = 'gpt-voice.close-html-preview'

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
  const htmlUri = `${workspaceUri}/index.html`
  await FileSystem.writeFile(
    htmlUri,
    '<!doctype html><html><body><h1>Hello Voice Preview</h1></body></html>',
  )
  await Workspace.setPath(workspaceUri)
  await Main.openUri(htmlUri)
  await Command.execute('Layout.showPreview', htmlUri)
  await Command.executeExtensionCommand('GptVoice.setIsTest')
  await SideBar.open('gpt-voice.views.default')

  const previewCloseButton = Locator('.PreviewCloseButton')
  await expect(previewCloseButton).toBeVisible()

  await Command.executeExtensionCommand('GptVoice.replayFixture', fixture)

  const voice = Locator('.GptVoice')
  const assistantTranscript = Locator('.GptVoiceTranscriptItemAi')
  await expect(previewCloseButton).toBeHidden()
  await expect(voice).toContainText('Ran close_html_preview')
  await expect(assistantTranscript).toHaveText(fixture.expect.assistantText)
}
