import { expect, jest, test } from '@jest/globals'
import {
  executeProcessExplorerFunctionToolCall,
  processExplorerFunctionTools,
} from '../src/parts/ProcessExplorerFunctionTools/ProcessExplorerFunctionTools.ts'

const getToolOutput = (messages: readonly string[]): unknown => {
  const message = JSON.parse(messages[0] || '{}')
  return JSON.parse(message.item.output)
}

interface TestApi {
  readonly openProcessExplorer: ReturnType<typeof jest.fn<() => Promise<void>>>
}

const createApi = (): TestApi => ({
  openProcessExplorer: jest.fn<() => Promise<void>>(async () => undefined),
})

test('exposes the process explorer tool definition', () => {
  expect(processExplorerFunctionTools).toEqual([
    {
      description: 'Open the LVCE Editor process explorer.',
      name: 'open_process_explorer',
      parameters: {
        additionalProperties: false,
        properties: {},
        type: 'object',
      },
      type: 'function',
    },
  ])
})

test.each([
  {
    arguments: '{}',
    call_id: 'process-explorer-call',
    name: 'open_process_explorer',
    type: 'response.function_call_arguments.done',
  },
  {
    item: {
      arguments: '{}',
      call_id: 'process-explorer-call',
      name: 'open_process_explorer',
      type: 'function_call',
    },
    type: 'response.output_item.done',
  },
] as const)(
  'opens the process explorer for completed function call %#',
  async (event: Readonly<Record<string, unknown>>) => {
    const api = createApi()
    const messages = await executeProcessExplorerFunctionToolCall(event, api)

    expect(api.openProcessExplorer).toHaveBeenCalledWith()
    expect(getToolOutput(messages || [])).toEqual({ opened: true })
    expect(messages?.[1]).toBe(JSON.stringify({ type: 'response.create' }))
  },
)

test('returns API failures to the model', async () => {
  const api = createApi()
  api.openProcessExplorer.mockRejectedValue(
    new Error('Process explorer unavailable'),
  )
  const messages = await executeProcessExplorerFunctionToolCall(
    {
      arguments: '{}',
      call_id: 'process-explorer-call',
      name: 'open_process_explorer',
      type: 'response.function_call_arguments.done',
    },
    api,
  )

  expect(getToolOutput(messages || [])).toEqual({
    error: 'Process explorer unavailable',
    hint: 'Try opening the process explorer again.',
    tool: 'open_process_explorer',
  })
})

test.each([
  undefined,
  null,
  {},
  {
    arguments: '{}',
    call_id: 'process-explorer-call',
    name: 'other_tool',
    type: 'response.function_call_arguments.done',
  },
  {
    item: {
      arguments: '{}',
      call_id: 'process-explorer-call',
      name: 'open_process_explorer',
      type: 'message',
    },
    type: 'response.output_item.done',
  },
] as const)(
  'ignores non-process-explorer function call %#',
  async (event: Readonly<Record<string, unknown>> | null | undefined) => {
    await expect(
      executeProcessExplorerFunctionToolCall(event),
    ).resolves.toBeUndefined()
  },
)
