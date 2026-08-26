import type * as Api from '@lvce-editor/api'
import { beforeEach, expect, jest, test } from '@jest/globals'

const invoke =
  jest.fn<(method: string, ...params: readonly unknown[]) => Promise<unknown>>()
const createRpc = jest.fn<typeof Api.createRpc>(
  async () => ({ invoke }) as never,
)
const executeFunctionTool = jest.fn(async () => '{"content":"value"}')
const getWorkTools = jest.fn(async () => [
  { name: 'read_workspace_file', type: 'function' },
])

// eslint-disable-next-line jest/no-restricted-jest-methods
jest.unstable_mockModule('@lvce-editor/api', () => ({ createRpc }))

// eslint-disable-next-line jest/no-restricted-jest-methods
jest.unstable_mockModule(
  '../src/parts/VoiceFunctionCallingWorker/VoiceFunctionCallingWorker.ts',
  () => ({ executeFunctionTool, getWorkTools }),
)

const VoiceWorkWorker =
  await import('../src/parts/VoiceWorkWorker/VoiceWorkWorker.ts')

beforeEach(() => {
  createRpc.mockClear()
  invoke.mockReset()
  executeFunctionTool.mockClear()
  getWorkTools.mockClear()
  VoiceWorkWorker.state.rpcPromise = undefined
})

test('creates the work worker and retrieves its delegation tool', async () => {
  invoke.mockResolvedValue({ name: 'do_work', type: 'function' })

  await expect(VoiceWorkWorker.getToolDefinition()).resolves.toEqual({
    name: 'do_work',
    type: 'function',
  })
  expect(createRpc).toHaveBeenCalledWith({
    commandMap: {
      'VoiceWorkHost.executeFunctionTool': executeFunctionTool,
    },
    id: 'builtin.gpt-voice.voice-work-worker',
  })
})

test('supplies low-level tools when executing delegated work', async () => {
  invoke.mockResolvedValue({ success: true, summary: 'done' })
  const configuration = {
    accessToken: 'token',
    endpoint: 'https://api.openai.com/v1/responses',
  }

  await expect(
    VoiceWorkWorker.execute('create a page', configuration),
  ).resolves.toEqual({ success: true, summary: 'done' })
  expect(invoke).toHaveBeenCalledWith('VoiceWork.execute', {
    configuration,
    task: 'create a page',
    tools: [{ name: 'read_workspace_file', type: 'function' }],
  })
})
