import type * as Api from '@lvce-editor/api'
import { beforeEach, expect, jest, test } from '@jest/globals'

const invoke =
  jest.fn<(method: string, ...params: readonly unknown[]) => Promise<unknown>>()
const createNodeRpc = jest.fn<typeof Api.createNodeRpc>(
  async () => ({ invoke }) as never,
)
const executeCommand = jest.fn<typeof Api.executeCommand>()
const getPreference = jest.fn<() => Promise<unknown>>(async () => false)
const getWorkspaceUri = jest.fn(async () => 'file:///workspace')

// eslint-disable-next-line jest/no-restricted-jest-methods
jest.unstable_mockModule('@lvce-editor/api', () => ({
  createNodeRpc,
  executeCommand,
  getPreference,
  getWorkspaceUri,
}))

const TerminalNode = await import('../src/parts/TerminalNode/TerminalNode.ts')

beforeEach(() => {
  createNodeRpc.mockClear()
  getPreference.mockReset()
  getPreference.mockResolvedValue(false)
  getWorkspaceUri.mockClear()
  executeCommand.mockReset()
  invoke.mockReset()
  TerminalNode.state.rpcPromise = undefined
})

test('is disabled unless the preference is exactly true', async () => {
  await expect(TerminalNode.isEnabled()).resolves.toBe(false)
  getPreference.mockResolvedValue('true')
  await expect(TerminalNode.isEnabled()).resolves.toBe(false)
  getPreference.mockResolvedValue(true)
  await expect(TerminalNode.isEnabled()).resolves.toBe(true)
})

test('refuses command execution while disabled', async () => {
  await expect(TerminalNode.executeBash('pwd')).rejects.toThrow(
    'Terminal tool access is disabled',
  )
  expect(createNodeRpc).not.toHaveBeenCalled()
  expect(getWorkspaceUri).not.toHaveBeenCalled()
})

test('executes in the opened workspace when enabled', async () => {
  getPreference.mockResolvedValue(true)
  const result = {
    exitCode: 0,
    stderr: '',
    stdout: '/workspace\n',
    timedOut: false,
  }
  invoke.mockResolvedValue(result)

  await expect(TerminalNode.executeBash('pwd')).resolves.toBe(result)

  expect(createNodeRpc).toHaveBeenCalledWith({
    id: 'builtin.gpt-voice.terminal-node',
  })
  expect(invoke).toHaveBeenCalledWith(
    'Terminal.executeBash',
    'pwd',
    'file:///workspace',
  )
})

test('requires an opened workspace before starting the node process', async () => {
  getPreference.mockResolvedValue(true)
  getWorkspaceUri.mockResolvedValue('')

  await expect(TerminalNode.executeBash('pwd')).rejects.toThrow(
    'Open a local workspace',
  )
  expect(createNodeRpc).not.toHaveBeenCalled()
})

test('runs a command in the visible integrated terminal', async () => {
  getPreference.mockResolvedValue(true)

  await expect(TerminalNode.runInTerminal('echo hello world')).resolves.toEqual(
    {
      command: 'echo hello world',
      success: true,
    },
  )

  expect(executeCommand).toHaveBeenNthCalledWith(
    1,
    'Layout.showPanel',
    'Terminals',
  )
  expect(executeCommand).toHaveBeenNthCalledWith(
    2,
    'Terminals.sendText',
    'echo hello world\r',
  )
  expect(createNodeRpc).not.toHaveBeenCalled()
})

test('refuses integrated terminal command execution while disabled', async () => {
  await expect(TerminalNode.runInTerminal('echo hello world')).rejects.toThrow(
    'Terminal tool access is disabled',
  )
  expect(executeCommand).not.toHaveBeenCalled()
})
