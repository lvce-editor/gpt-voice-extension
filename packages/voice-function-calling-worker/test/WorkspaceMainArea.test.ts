import { expect, jest, test } from '@jest/globals'
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

  await expect(openWorkspaceFile('src/index.ts', api)).resolves.toEqual({
    opened: true,
    path: 'src/index.ts',
  })
  expect(api.openUri).toHaveBeenCalledWith('file:///workspace/src/index.ts')
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
