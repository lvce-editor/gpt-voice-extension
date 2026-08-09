import { activate, registerFormattingProvider } from '@lvce-editor/api'

await activate()

registerFormattingProvider({
  format(textDocument) {
    return [
      {
        endOffset: textDocument.text.length,
        inserted: textDocument.text.replace('const value=1', 'const value = 1'),
        startOffset: 0,
      },
    ]
  },
  id: 'sampleVoiceFormatter',
  languageId: 'xyz',
})
