import type * as Api from '@lvce-editor/api'
import type { VoiceWorkToolCallEvent } from 'voice-shared'
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
  VoiceWorkWorker.state.nextWorkId = 1
  VoiceWorkWorker.state.rpcPromise = undefined
})

const getCommandMap = (): Record<
  string,
  (...args: readonly unknown[]) => unknown
> => {
  const options = createRpc.mock.calls[0]?.[0]
  if (!options?.commandMap) {
    throw new Error('Expected voice work RPC command map')
  }
  return options.commandMap as Record<
    string,
    (...args: readonly unknown[]) => unknown
  >
}

test('creates the work worker and retrieves its delegation tool', async () => {
  invoke.mockResolvedValue({ name: 'do_work', type: 'function' })

  await expect(VoiceWorkWorker.getToolDefinition()).resolves.toEqual({
    name: 'do_work',
    type: 'function',
  })
  expect(createRpc).toHaveBeenCalledWith({
    commandMap: {
      'VoiceWorkHost.executeFunctionTool': executeFunctionTool,
      'VoiceWorkHost.reportToolCall': expect.any(Function),
    },
    id: 'builtin.gpt-voice.voice-work-worker',
  })
})

test('supplies low-level tools when executing delegated work', async () => {
  invoke.mockResolvedValue({ success: true, summary: 'done' })
  const onToolCall = jest.fn<(event: VoiceWorkToolCallEvent) => Promise<void>>(
    async () => undefined,
  )
  const configuration = {
    accessToken: 'token',
    endpoint: 'https://api.openai.com/v1/responses',
  }

  await expect(
    VoiceWorkWorker.execute('create a page', configuration, onToolCall),
  ).resolves.toEqual({ success: true, summary: 'done' })
  expect(invoke).toHaveBeenCalledWith('VoiceWork.execute', {
    configuration,
    task: 'create a page',
    tools: [{ name: 'read_workspace_file', type: 'function' }],
    workId: 1,
  })

  const commandMap = getCommandMap()
  await commandMap['VoiceWorkHost.reportToolCall']?.(1, {
    argumentsValue: '{}',
    callId: 'call-1',
    name: 'read_workspace_file',
    type: 'started',
  })
  expect(onToolCall).not.toHaveBeenCalled()
})

test('forwards tool-call events while delegated work is running', async () => {
  const onToolCall = jest.fn<(event: VoiceWorkToolCallEvent) => Promise<void>>(
    async () => undefined,
  )
  const { promise, resolve } = Promise.withResolvers<unknown>()
  invoke.mockReturnValue(promise)
  const configuration = {
    accessToken: 'token',
    endpoint: 'https://api.openai.com/v1/responses',
  }

  const work = VoiceWorkWorker.execute(
    'create a page',
    configuration,
    onToolCall,
  )
  await Promise.resolve()
  await Promise.resolve()
  const commandMap = getCommandMap()
  const event = {
    argumentsValue: '{}',
    callId: 'call-1',
    name: 'read_workspace_file',
    type: 'started',
  } as const
  await commandMap['VoiceWorkHost.reportToolCall']?.(1, event)

  expect(onToolCall).toHaveBeenCalledWith(event)
  resolve({ success: true, summary: 'done' })
  await expect(work).resolves.toEqual({ success: true, summary: 'done' })
})
