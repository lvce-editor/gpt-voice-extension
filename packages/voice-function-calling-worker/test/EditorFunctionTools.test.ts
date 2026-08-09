import { expect, jest, test } from '@jest/globals'
import {
  editorFunctionTools,
  executeEditorFunctionToolCall,
} from '../src/parts/EditorFunctionTools/EditorFunctionTools.ts'

const getToolOutput = (messages: readonly string[]): unknown => {
  const message = JSON.parse(messages[0] || '{}')
  return JSON.parse(message.item.output)
}

interface EditorSelection {
  readonly endColumnIndex: number
  readonly endRowIndex: number
  readonly startColumnIndex: number
  readonly startRowIndex: number
}

const createApi: () => {
  readonly formatDocument: ReturnType<typeof jest.fn<() => Promise<void>>>
  readonly getDiagnostics: ReturnType<
    typeof jest.fn<() => Promise<readonly unknown[]>>
  >
  readonly getEditorSelections: ReturnType<
    typeof jest.fn<
      () => Promise<
        readonly {
          readonly endColumnIndex: number
          readonly endRowIndex: number
          readonly startColumnIndex: number
          readonly startRowIndex: number
        }[]
      >
    >
  >
  readonly setEditorSelections: ReturnType<
    typeof jest.fn<(selections: readonly EditorSelection[]) => Promise<void>>
  >
  readonly showCompletions: ReturnType<typeof jest.fn<() => Promise<void>>>
} = () => ({
  formatDocument: jest.fn<() => Promise<void>>(async () => undefined),
  getDiagnostics: jest.fn<() => Promise<readonly unknown[]>>(async () => []),
  getEditorSelections: jest.fn(async () => []),
  setEditorSelections: jest.fn(async () => undefined),
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
    'get_editor_selections',
    'set_editor_selections',
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

test('returns active editor selections with 1-based positions', async () => {
  const api = createApi()
  api.getEditorSelections.mockResolvedValue([
    {
      endColumnIndex: 8,
      endRowIndex: 4,
      startColumnIndex: 2,
      startRowIndex: 3,
    },
  ])
  const messages = await executeEditorFunctionToolCall(
    createFunctionCall('get_editor_selections'),
    api,
  )

  expect(getToolOutput(messages || [])).toEqual({
    count: 1,
    selections: [{ endColumn: 9, endLine: 5, startColumn: 3, startLine: 4 }],
  })
})

test('sets active editor selections from 1-based positions', async () => {
  const api = createApi()
  const selections = [
    { endColumn: 9, endLine: 5, startColumn: 3, startLine: 4 },
  ]
  const messages = await executeEditorFunctionToolCall(
    createFunctionCall('set_editor_selections', JSON.stringify({ selections })),
    api,
  )

  expect(api.setEditorSelections).toHaveBeenCalledWith([
    {
      endColumnIndex: 8,
      endRowIndex: 4,
      startColumnIndex: 2,
      startRowIndex: 3,
    },
  ])
  expect(getToolOutput(messages || [])).toEqual({
    count: 1,
    selected: true,
    selections,
  })
})

test.each([
  '{}',
  '{"selections":[]}',
  '{"selections":[{"startLine":0,"startColumn":1,"endLine":1,"endColumn":1}]}',
])('rejects invalid editor selections: %s', async (argumentsValue) => {
  const api = createApi()
  const messages = await executeEditorFunctionToolCall(
    createFunctionCall('set_editor_selections', argumentsValue),
    api,
  )

  expect(api.setEditorSelections).not.toHaveBeenCalled()
  expect(getToolOutput(messages || [])).toEqual(
    expect.objectContaining({ tool: 'set_editor_selections' }),
  )
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
