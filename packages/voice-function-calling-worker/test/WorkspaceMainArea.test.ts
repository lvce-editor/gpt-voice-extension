import { expect, jest, test } from '@jest/globals'
import type { WorkspaceFileSystemApi } from '../src/parts/WorkspaceFileSystem/WorkspaceFileSystem.ts'
import {
  closeWorkspaceFile,
  openWorkspaceFile,
  setQuickPickValue,
  showFileQuickPick,
  type WorkspaceMainAreaApi,
} from '../src/parts/WorkspaceMainArea/WorkspaceMainArea.ts'

const createApi = (
  workspaceUri = 'file:///workspace',
): WorkspaceMainAreaApi => ({
  closeUri: jest.fn(async () => undefined),
  getWorkspaceUri: jest.fn(async () => workspaceUri),
  openUri: jest.fn(async () => undefined),
  setQuickPickValue: jest.fn(async () => undefined),
  showFileQuickPick: jest.fn(async () => undefined),
})

const createFileSystemApi = (): WorkspaceFileSystemApi => ({
  exists: jest.fn(async () => true),
  getWorkspaceUri: jest.fn(async () => 'file:///workspace'),
  readDirWithFileTypes: jest.fn(async () => []),
  readFile: jest.fn(async () => ''),
  writeFile: jest.fn(async () => undefined),
})

test('setQuickPickValue updates the editor quick pick input', async () => {
  const api = createApi()

  await expect(setQuickPickValue('ci.yaml', api)).resolves.toEqual({
    updated: true,
    value: 'ci.yaml',
  })
  expect(api.setQuickPickValue).toHaveBeenCalledWith('ci.yaml')
})

test('showFileQuickPick opens the editor file quick pick', async () => {
  const api = createApi()

  await expect(showFileQuickPick(api)).resolves.toEqual({ shown: true })
  expect(api.showFileQuickPick).toHaveBeenCalledWith()
})

test('openWorkspaceFile opens a resolved workspace URI', async () => {
  const api = createApi()
  const fileSystemApi = createFileSystemApi()

  await expect(
    openWorkspaceFile('src/index.ts', api, fileSystemApi),
  ).resolves.toEqual({
    opened: true,
    path: 'src/index.ts',
  })
  expect(fileSystemApi.exists).toHaveBeenCalledWith(
    'file:///workspace/src/index.ts',
  )
  expect(api.openUri).toHaveBeenCalledWith('file:///workspace/src/index.ts')
})

test('openWorkspaceFile does not open a missing file', async () => {
  const api = createApi()
  const fileSystemApi = createFileSystemApi()
  jest.mocked(fileSystemApi.exists).mockResolvedValue(false)

  await expect(
    openWorkspaceFile('missing.ts', api, fileSystemApi),
  ).rejects.toThrow('Workspace file "missing.ts" was not found.')
  expect(api.openUri).not.toHaveBeenCalled()
})

test('closeWorkspaceFile closes a resolved workspace URI', async () => {
  const api = createApi('github://owner/repo')

  await expect(closeWorkspaceFile('src/index.ts', api)).resolves.toEqual({
    closed: true,
    path: 'src/index.ts',
  })
  expect(api.closeUri).toHaveBeenCalledWith('github://owner/repo/src/index.ts')
})

test.each([openWorkspaceFile, closeWorkspaceFile])(
  'rejects paths outside the workspace',
  async (operation) => {
    const api = createApi()

    await expect(operation('../outside.ts', api)).rejects.toThrow(
      'Workspace file path cannot leave the opened workspace.',
    )
    expect(api.openUri).not.toHaveBeenCalled()
    expect(api.closeUri).not.toHaveBeenCalled()
  },
)
