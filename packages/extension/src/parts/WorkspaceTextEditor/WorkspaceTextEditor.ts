import { executeCommand, openUri } from '@lvce-editor/api'

interface TextDocument {
  readonly text: string
  readonly uri: string
}

interface TextEdit {
  readonly deleted: number
  readonly inserted: string
  readonly offset: number
}

export interface WorkspaceTextEditorApi {
  readonly executeCommand: (
    method: string,
    ...params: readonly unknown[]
  ) => Promise<unknown>
  readonly openUri: (uri: string) => Promise<void>
}

const defaultApi: WorkspaceTextEditorApi = {
  executeCommand,
  openUri,
}

const isTextDocument = (value: unknown): value is TextDocument => {
  return (
    value !== null &&
    typeof value === 'object' &&
    'text' in value &&
    typeof value.text === 'string' &&
    'uri' in value &&
    typeof value.uri === 'string'
  )
}

export const getTextEdit = (
  currentContent: string,
  newContent: string,
): TextEdit | undefined => {
  if (currentContent === newContent) {
    return undefined
  }
  const maximumPrefixLength = Math.min(currentContent.length, newContent.length)
  let offset = 0
  while (
    offset < maximumPrefixLength &&
    currentContent[offset] === newContent[offset]
  ) {
    offset++
  }
  let currentEnd = currentContent.length
  let newEnd = newContent.length
  while (
    currentEnd > offset &&
    newEnd > offset &&
    currentContent[currentEnd - 1] === newContent[newEnd - 1]
  ) {
    currentEnd--
    newEnd--
  }
  return {
    deleted: currentEnd - offset,
    inserted: newContent.slice(offset, newEnd),
    offset,
  }
}

const getOpenTextDocument = async (
  uri: string,
  api: WorkspaceTextEditorApi,
): Promise<TextDocument | undefined> => {
  const openEditorUris = await api.executeCommand(
    'GetActiveEditor.getOpenEditorUris',
  )
  if (!Array.isArray(openEditorUris) || !openEditorUris.includes(uri)) {
    return undefined
  }
  await api.openUri(uri)
  const textDocument = await api.executeCommand(
    'GetActiveEditor.getTextDocument',
  )
  if (!isTextDocument(textDocument) || textDocument.uri !== uri) {
    return undefined
  }
  return textDocument
}

export const readOpenTextDocument = async (
  uri: string,
  api: WorkspaceTextEditorApi = defaultApi,
): Promise<string | undefined> => {
  const textDocument = await getOpenTextDocument(uri, api)
  return textDocument?.text
}

export const writeOpenTextDocument = async (
  uri: string,
  content: string,
  api: WorkspaceTextEditorApi = defaultApi,
): Promise<boolean> => {
  const textDocument = await getOpenTextDocument(uri, api)
  if (!textDocument) {
    return false
  }
  const editorId = await api.executeCommand('GetActiveEditor.getActiveEditorId')
  if (typeof editorId !== 'number' || editorId < 0) {
    return false
  }
  const edit = getTextEdit(textDocument.text, content)
  if (edit) {
    await api.executeCommand(
      'Viewlet.executeViewletCommand',
      editorId,
      'applyWorkspaceEdit',
      [{ edits: [edit], uri }],
    )
  }
  await api.executeCommand('Main.save')
  return true
}
