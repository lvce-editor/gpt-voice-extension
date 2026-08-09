import { expect, jest, test } from '@jest/globals'
import {
  editorFunctionTools,
  executeEditorFunctionToolCall,
} from '../src/parts/EditorFunctionTools/EditorFunctionTools.ts'

const getToolOutput = (messages: readonly string[]): unknown => {
  const message = JSON.parse(messages[0] || '{}')
  return JSON.parse(message.item.output)
}

const createApi: () => {
  readonly formatDocument: ReturnType<typeof jest.fn<() => Promise<void>>>
  readonly getDiagnostics: ReturnType<
    typeof jest.fn<() => Promise<readonly unknown[]>>
  >
  readonly showCompletions: ReturnType<typeof jest.fn<() => Promise<void>>>
} = () => ({
  formatDocument: jest.fn<() => Promise<void>>(async () => undefined),
  getDiagnostics: jest.fn<() => Promise<readonly unknown[]>>(async () => []),
  showCompletions: jest.fn<() => Promise<void>>(async () => undefined),
})

const createFunctionCall = (
  name: string,
  argumentsValue = '{}',
): Readonly<Record<string, string>> => ({
  arguments: argumentsValue,
  call_id: 'editor-call',
  name,
  type: 'response.function_call_arguments.done',
})

test('exposes editor tool definitions', () => {
  expect(editorFunctionTools.map(({ name }) => name)).toEqual([
    'format_document',
    'get_editor_diagnostics',
    'show_completions',
  ])
})

test('formats the active document', async () => {
  const api = createApi()
  const messages = await executeEditorFunctionToolCall(
    createFunctionCall('format_document'),
    api,
  )

  expect(api.formatDocument).toHaveBeenCalledWith()
  expect(getToolOutput(messages || [])).toEqual({ formatted: true })
})

test('returns active editor diagnostics', async () => {
  const api = createApi()
  const diagnostics = [{ message: 'Missing semicolon', type: 'warning' }]
  api.getDiagnostics.mockResolvedValue(diagnostics)
  const messages = await executeEditorFunctionToolCall(
    createFunctionCall('get_editor_diagnostics'),
    api,
  )

  expect(getToolOutput(messages || [])).toEqual({ count: 1, diagnostics })
})

test('shows smart completions', async () => {
  const api = createApi()
  const messages = await executeEditorFunctionToolCall(
    {
      item: {
        arguments: '{}',
        call_id: 'editor-call',
        name: 'show_completions',
        type: 'function_call',
      },
      type: 'response.output_item.done',
    },
    api,
  )

  expect(api.showCompletions).toHaveBeenCalledWith()
  expect(getToolOutput(messages || [])).toEqual({ shown: true })
})

test('returns API failures to the model', async () => {
  const api = createApi()
  api.formatDocument.mockRejectedValue(new Error('No formatter found'))
  const messages = await executeEditorFunctionToolCall(
    createFunctionCall('format_document'),
    api,
  )

  expect(getToolOutput(messages || [])).toEqual({
    error: 'No formatter found',
    hint: 'Pass no arguments and make sure a text document is open in the active editor.',
    tool: 'format_document',
  })
})

test('ignores unrelated calls', async () => {
  await expect(
    executeEditorFunctionToolCall(createFunctionCall('read_workspace_file')),
  ).resolves.toBeUndefined()
})
