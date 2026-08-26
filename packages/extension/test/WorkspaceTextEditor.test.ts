import { expect, jest, test } from '@jest/globals'
import {
  getTextEdit,
  readOpenTextDocument,
  writeOpenTextDocument,
  type WorkspaceTextEditorApi,
} from '../src/parts/WorkspaceTextEditor/WorkspaceTextEditor.ts'

const createApi = (): WorkspaceTextEditorApi => ({
  executeCommand: jest.fn(async () => undefined),
  openUri: jest.fn(async () => undefined),
})

test.each([
  ['abc', 'abc', undefined],
  ['abc', 'axc', { deleted: 1, inserted: 'x', offset: 1 }],
  ['abc', 'ab', { deleted: 1, inserted: '', offset: 2 }],
  ['ab', 'abc', { deleted: 0, inserted: 'c', offset: 2 }],
  ['', 'abc', { deleted: 0, inserted: 'abc', offset: 0 }],
  ['abc', '', { deleted: 3, inserted: '', offset: 0 }],
])('creates a minimal text edit for %s -> %s', (current, next, expected) => {
  expect(getTextEdit(current, next)).toEqual(expected)
})

test('returns false when the file is not open', async () => {
  const api = createApi()
  jest.mocked(api.executeCommand).mockResolvedValue([])

  await expect(
    writeOpenTextDocument('file:///workspace/file.ts', 'new content', api),
  ).resolves.toBe(false)

  expect(api.executeCommand).toHaveBeenCalledWith(
    'GetActiveEditor.getOpenEditorUris',
  )
  expect(api.openUri).not.toHaveBeenCalled()
})

test('reads live contents from an open text document', async () => {
  const api = createApi()
  jest
    .mocked(api.executeCommand)
    .mockResolvedValueOnce(['file:///workspace/file.ts'])
    .mockResolvedValueOnce({
      text: 'unsaved content',
      uri: 'file:///workspace/file.ts',
    })

  await expect(
    readOpenTextDocument('file:///workspace/file.ts', api),
  ).resolves.toBe('unsaved content')

  expect(api.openUri).toHaveBeenCalledWith('file:///workspace/file.ts')
})

test('applies live document edits and saves the editor', async () => {
  const api = createApi()
  jest
    .mocked(api.executeCommand)
    .mockResolvedValueOnce(['file:///workspace/file.ts'])
    .mockResolvedValueOnce({
      text: 'const value = 1',
      uri: 'file:///workspace/file.ts',
    })
    .mockResolvedValueOnce(42)
    .mockResolvedValue(undefined)

  await expect(
    writeOpenTextDocument('file:///workspace/file.ts', 'const value = 2', api),
  ).resolves.toBe(true)

  expect(api.openUri).toHaveBeenCalledWith('file:///workspace/file.ts')
  expect(api.executeCommand).toHaveBeenNthCalledWith(
    2,
    'GetActiveEditor.getTextDocument',
  )
  expect(api.executeCommand).toHaveBeenNthCalledWith(
    3,
    'GetActiveEditor.getActiveEditorId',
  )
  expect(api.executeCommand).toHaveBeenNthCalledWith(
    4,
    'Viewlet.executeViewletCommand',
    42,
    'applyWorkspaceEdit',
    [
      {
        edits: [{ deleted: 1, inserted: '2', offset: 14 }],
        uri: 'file:///workspace/file.ts',
      },
    ],
  )
  expect(api.executeCommand).toHaveBeenNthCalledWith(5, 'Main.save')
})

test('saves an unchanged open document without applying an edit', async () => {
  const api = createApi()
  jest
    .mocked(api.executeCommand)
    .mockResolvedValueOnce(['file:///workspace/file.ts'])
    .mockResolvedValueOnce({
      text: 'same content',
      uri: 'file:///workspace/file.ts',
    })
    .mockResolvedValueOnce(42)
    .mockResolvedValue(undefined)

  await expect(
    writeOpenTextDocument('file:///workspace/file.ts', 'same content', api),
  ).resolves.toBe(true)

  expect(api.executeCommand).toHaveBeenCalledTimes(4)
  expect(api.executeCommand).toHaveBeenLastCalledWith('Main.save')
})

test('returns false when the open file is not a text editor', async () => {
  const api = createApi()
  jest
    .mocked(api.executeCommand)
    .mockResolvedValueOnce(['file:///workspace/file.png'])
    .mockResolvedValueOnce(undefined)

  await expect(
    writeOpenTextDocument('file:///workspace/file.png', 'content', api),
  ).resolves.toBe(false)

  expect(api.executeCommand).toHaveBeenCalledTimes(2)
})

test('returns false when the active editor has no valid id', async () => {
  const api = createApi()
  jest
    .mocked(api.executeCommand)
    .mockResolvedValueOnce(['file:///workspace/file.ts'])
    .mockResolvedValueOnce({
      text: 'content',
      uri: 'file:///workspace/file.ts',
    })
    .mockResolvedValueOnce(-1)

  await expect(
    writeOpenTextDocument('file:///workspace/file.ts', 'new content', api),
  ).resolves.toBe(false)

  expect(api.executeCommand).toHaveBeenCalledTimes(3)
})
