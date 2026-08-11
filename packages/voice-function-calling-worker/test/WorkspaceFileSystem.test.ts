import { expect, jest, test } from '@jest/globals'
import {
  ensureWorkspaceFileExists,
  listWorkspaceDirectory,
  readWorkspaceFile,
  resolveWorkspaceDirectoryUri,
  resolveWorkspaceFileUri,
  searchWorkspaceFiles,
  type WorkspaceFileSystemApi,
  writeWorkspaceFile,
} from '../src/parts/WorkspaceFileSystem/WorkspaceFileSystem.ts'

const createApi = (
  workspaceUri = 'file:///workspace',
): WorkspaceFileSystemApi => ({
  exists: jest.fn(async () => true),
  getWorkspaceUri: jest.fn(async () => workspaceUri),
  readDirWithFileTypes: jest.fn(async () => [
    { name: 'src', type: 3 },
    { name: 'package.json', type: 7 },
  ]),
  readFile: jest.fn(async () => 'file content'),
  writeFile: jest.fn(async () => undefined),
})

test.each([
  ['file:///workspace', 'src/index.ts', 'file:///workspace/src/index.ts'],
  ['file:///workspace/', './src/index.ts', 'file:///workspace/src/index.ts'],
  ['github://owner/repo', 'src\\index.ts', 'github://owner/repo/src/index.ts'],
  [
    'file:///C:/workspace',
    'folder name/file.txt',
    'file:///C:/workspace/folder%20name/file.txt',
  ],
])(
  'resolveWorkspaceFileUri - resolves %s and %s',
  (workspaceUri, relativePath, expected) => {
    expect(resolveWorkspaceFileUri(workspaceUri, relativePath)).toBe(expected)
  },
)

test.each([
  ['file:///workspace', '.', 'file:///workspace'],
  ['file:///workspace/', 'src', 'file:///workspace/src'],
  ['memfs:///workspace', '.', 'memfs:///workspace'],
  [
    'remote-ssh://host/workspace',
    'src/lib',
    'remote-ssh://host/workspace/src/lib',
  ],
])(
  'resolveWorkspaceDirectoryUri - resolves %s and %s',
  (workspaceUri, relativePath, expected) => {
    expect(resolveWorkspaceDirectoryUri(workspaceUri, relativePath)).toBe(
      expected,
    )
  },
)

test.each([
  ['', 'file.txt', 'No workspace folder is currently open.'],
  [
    '/workspace',
    'file.txt',
    'The opened workspace does not provide a valid filesystem URI.',
  ],
  ['file:///workspace', '', 'Workspace file path is required.'],
  ['file:///workspace', '.', 'Workspace file path is required.'],
  [
    'file:///workspace',
    '/tmp/file.txt',
    'Workspace file path must be relative.',
  ],
  [
    'file:///workspace',
    '\\tmp\\file.txt',
    'Workspace file path must be relative.',
  ],
  [
    'file:///workspace',
    'C:\\tmp\\file.txt',
    'Workspace file path must be relative.',
  ],
  [
    'file:///workspace',
    'file:///tmp/file.txt',
    'Workspace file path must be relative.',
  ],
  [
    'file:///workspace',
    '../outside.txt',
    'Workspace file path cannot leave the opened workspace.',
  ],
  [
    'file:///workspace',
    'src\\..\\..\\outside.txt',
    'Workspace file path cannot leave the opened workspace.',
  ],
])(
  'resolveWorkspaceFileUri - rejects unsafe path %#',
  (workspaceUri, relativePath, message) => {
    expect(() => resolveWorkspaceFileUri(workspaceUri, relativePath)).toThrow(
      message,
    )
  },
)

test.each([
  ['file:///workspace', '', 'Workspace directory path is required.'],
  ['file:///workspace', '/tmp', 'Workspace directory path must be relative.'],
  [
    'file:///workspace',
    '../outside',
    'Workspace directory path cannot leave the opened workspace.',
  ],
])(
  'resolveWorkspaceDirectoryUri - rejects unsafe path %#',
  (workspaceUri, relativePath, message) => {
    expect(() =>
      resolveWorkspaceDirectoryUri(workspaceUri, relativePath),
    ).toThrow(message)
  },
)

test('listWorkspaceDirectory - lists sorted workspace entries', async () => {
  const api = createApi()

  await expect(listWorkspaceDirectory('.', api)).resolves.toEqual({
    entries: [
      { name: 'package.json', type: 'file' },
      { name: 'src', type: 'directory' },
    ],
    path: '.',
  })
  expect(api.readDirWithFileTypes).toHaveBeenCalledWith('file:///workspace')
})

test('searchWorkspaceFiles - finds a file in a hidden nested directory', async () => {
  const api = createApi()
  jest.mocked(api.readDirWithFileTypes).mockImplementation(async (uri) => {
    switch (uri) {
      case 'file:///workspace':
        return [
          { name: 'src', type: 3 },
          { name: '.devcontainer', type: 3 },
          { name: 'node_modules', type: 3 },
        ]
      case 'file:///workspace/.devcontainer':
        return [{ name: 'devcontainer.json', type: 7 }]
      case 'file:///workspace/src':
        return [{ name: 'index.ts', type: 7 }]
      default:
        throw new Error(`Unexpected directory: ${uri}`)
    }
  })

  await expect(searchWorkspaceFiles('devcontainer json', api)).resolves.toEqual(
    {
      matches: ['.devcontainer/devcontainer.json'],
      query: 'devcontainer json',
      truncated: false,
    },
  )
  expect(api.readDirWithFileTypes).not.toHaveBeenCalledWith(
    'file:///workspace/node_modules',
  )
})

test.each([
  ['release.yaml', 'release.yml'],
  ['release.yml', 'release.yaml'],
])(
  'searchWorkspaceFiles - treats YAML extensions as equivalent for %s',
  async (query, fileName) => {
    const api = createApi()
    jest
      .mocked(api.readDirWithFileTypes)
      .mockResolvedValue([{ name: fileName, type: 7 }])

    await expect(searchWorkspaceFiles(query, api)).resolves.toEqual({
      matches: [fileName],
      query,
      truncated: false,
    })
  },
)

test('searchWorkspaceFiles - excludes gitignored build output', async () => {
  const api = createApi()
  jest.mocked(api.readDirWithFileTypes).mockImplementation(async (uri) => {
    switch (uri) {
      case 'file:///workspace':
        return [
          { name: '.gitignore', type: 7 },
          { name: 'dist', type: 3 },
          { name: 'packages', type: 3 },
        ]
      case 'file:///workspace/packages':
        return [{ name: 'extension', type: 3 }]
      case 'file:///workspace/packages/extension':
        return [
          { name: '.gitignore', type: 7 },
          { name: 'extension.json', type: 7 },
        ]
      default:
        throw new Error(`Unexpected directory: ${uri}`)
    }
  })
  jest.mocked(api.readFile).mockImplementation(async (uri) => {
    switch (uri) {
      case 'file:///workspace/.gitignore':
        return 'dist\n*.json'
      case 'file:///workspace/packages/extension/.gitignore':
        return '!extension.json'
      default:
        throw new Error(`Unexpected file: ${uri}`)
    }
  })

  await expect(searchWorkspaceFiles('extension json', api)).resolves.toEqual({
    matches: ['packages/extension/extension.json'],
    query: 'extension json',
    truncated: false,
  })
  expect(api.readDirWithFileTypes).not.toHaveBeenCalledWith(
    'file:///workspace/dist',
  )
})

test.each(['', '...'])(
  'searchWorkspaceFiles - rejects invalid query %s',
  async (query) => {
    const api = createApi()

    await expect(searchWorkspaceFiles(query, api)).rejects.toThrow(
      query ? 'must contain a letter or number' : 'query is required',
    )
    expect(api.getWorkspaceUri).not.toHaveBeenCalled()
  },
)

test('searchWorkspaceFiles - ignores unreadable nested directories', async () => {
  const api = createApi()
  jest.mocked(api.readDirWithFileTypes).mockImplementation(async (uri) => {
    if (uri === 'file:///workspace') {
      return [{ name: 'restricted', type: 3 }]
    }
    throw new Error('Permission denied')
  })

  await expect(searchWorkspaceFiles('file', api)).resolves.toEqual({
    matches: [],
    query: 'file',
    truncated: false,
  })
})

test('ensureWorkspaceFileExists - verifies the resolved file URI', async () => {
  const api = createApi()

  await expect(
    ensureWorkspaceFileExists('file:///workspace', 'src/index.ts', api),
  ).resolves.toBeUndefined()
  expect(api.exists).toHaveBeenCalledWith('file:///workspace/src/index.ts')
})

test('ensureWorkspaceFileExists - rejects a missing file', async () => {
  const api = createApi()
  jest.mocked(api.exists).mockResolvedValue(false)

  await expect(
    ensureWorkspaceFileExists('file:///workspace', 'missing.ts', api),
  ).rejects.toThrow('Workspace file "missing.ts" was not found.')
})

test.each([
  [1, 'block-device'],
  [2, 'character-device'],
  [4, 'directory'],
  [5, 'directory'],
  [6, 'fifo'],
  [8, 'socket'],
  [9, 'symbolic-link'],
  [10, 'file'],
  [11, 'directory'],
  [12, 'unknown'],
])(
  'listWorkspaceDirectory - maps file type %s to %s',
  async (type, expected) => {
    const api = createApi()
    jest
      .mocked(api.readDirWithFileTypes)
      .mockResolvedValue([{ name: 'entry', type }])

    await expect(listWorkspaceDirectory('src', api)).resolves.toEqual({
      entries: [{ name: 'entry', type: expected }],
      path: 'src',
    })
  },
)

test('readWorkspaceFile - reads resolved workspace file', async () => {
  const api = createApi()

  await expect(readWorkspaceFile('src/index.ts', api)).resolves.toEqual({
    content: 'file content',
    path: 'src/index.ts',
  })
  expect(api.readFile).toHaveBeenCalledWith('file:///workspace/src/index.ts')
})

test('writeWorkspaceFile - writes resolved workspace file', async () => {
  const api = createApi()

  await expect(
    writeWorkspaceFile('src/index.ts', 'new content', api),
  ).resolves.toEqual({
    path: 'src/index.ts',
    written: true,
  })
  expect(api.writeFile).toHaveBeenCalledWith(
    'file:///workspace/src/index.ts',
    'new content',
  )
})

test('listWorkspaceDirectory - adds operation context to errors', async () => {
  const api = createApi()
  jest
    .mocked(api.readDirWithFileTypes)
    .mockRejectedValue(new TypeError('URI is unavailable'))

  await expect(listWorkspaceDirectory('.', api)).rejects.toThrow(
    'Failed to list workspace directory ".": URI is unavailable',
  )
})

test('readWorkspaceFile - adds operation context to errors', async () => {
  const api = createApi()
  jest.mocked(api.readFile).mockRejectedValue(new Error('Not found'))

  await expect(readWorkspaceFile('missing.txt', api)).rejects.toThrow(
    'Failed to read workspace file "missing.txt": Not found',
  )
})

test('writeWorkspaceFile - adds operation context to errors', async () => {
  const api = createApi()
  jest.mocked(api.writeFile).mockRejectedValue('Read only')

  await expect(writeWorkspaceFile('file.txt', 'content', api)).rejects.toThrow(
    'Failed to write workspace file "file.txt": Read only',
  )
})
