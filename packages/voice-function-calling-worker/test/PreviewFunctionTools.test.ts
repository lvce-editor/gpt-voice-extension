import { expect, jest, test } from '@jest/globals'
import {
  executePreviewFunctionToolCall,
  previewFunctionTools,
} from '../src/parts/PreviewFunctionTools/PreviewFunctionTools.ts'

interface TestApi {
  readonly getOpenEditorUris: () => Promise<readonly string[]>
  readonly open: (uri: string) => Promise<void>
}

const createApi = (uris: readonly string[] = []): TestApi => ({
  getOpenEditorUris: jest.fn(async () => uris),
  open: jest.fn(async () => undefined),
})

const execute = (argumentsValue: string, api: TestApi) => {
  return executePreviewFunctionToolCall(
    {
      arguments: argumentsValue,
      call_id: 'preview-call',
      name: 'open_html_preview',
      type: 'response.function_call_arguments.done',
    },
    api,
  )
}

const parseOutput = (messages: readonly string[] | undefined): unknown => {
  const message = JSON.parse(messages?.[0] || '{}')
  return JSON.parse(message.item.output)
}

test('defines the HTML preview tool', () => {
  expect(previewFunctionTools).toEqual([
    {
      description:
        'Open an HTML file in the LVCE Editor preview area. Omit uri when exactly one HTML editor tab is open. If multiple HTML tabs are open, use get_open_editor_tabs and pass the desired tab URI.',
      name: 'open_html_preview',
      parameters: {
        additionalProperties: false,
        properties: {
          uri: {
            description:
              'Optional full URI of an open .html or .htm editor tab to preview.',
            type: 'string',
          },
        },
        type: 'object',
      },
      type: 'function',
    },
  ])
})

test('opens the only HTML editor in the preview area', async () => {
  const api = createApi([
    'file:///workspace/readme.md',
    'file:///workspace/index.html',
  ])

  const messages = await execute('{}', api)

  expect(api.getOpenEditorUris).toHaveBeenCalledWith()
  expect(api.open).toHaveBeenCalledWith('file:///workspace/index.html')
  expect(parseOutput(messages)).toEqual({ opened: true })
})

test('opens an explicitly selected HTML editor URI', async () => {
  const api = createApi()

  const messages = await execute('{"uri":"file:///workspace/about.htm"}', api)

  expect(api.getOpenEditorUris).not.toHaveBeenCalled()
  expect(api.open).toHaveBeenCalledWith('file:///workspace/about.htm')
  expect(parseOutput(messages)).toEqual({ opened: true })
})

test.each([
  [[], 'No open HTML editor tab was found.'],
  [
    ['file:///workspace/index.html', 'file:///workspace/about.html'],
    'Multiple HTML editor tabs are open. Pass the URI of the file to preview.',
  ],
] as const)('returns a useful selection error for %#', async (uris, error) => {
  const api = createApi(uris)

  const messages = await execute('{}', api)

  expect(api.open).not.toHaveBeenCalled()
  expect(parseOutput(messages)).toEqual({
    error,
    hint: 'Open an HTML editor tab first. Pass its full URI when more than one HTML tab is open.',
    tool: 'open_html_preview',
  })
})

test.each([
  ['{', 'Function tool arguments must be valid JSON.'],
  ['[]', 'Function tool arguments must be a JSON object.'],
  ['{"uri":""}', 'Function tool argument "uri" must be a string.'],
  [
    '{"uri":"file:///workspace/readme.md"}',
    'The preview URI must reference an .html or .htm file.',
  ],
])('returns a tool error for invalid arguments: %s', async (value, error) => {
  const api = createApi()

  const messages = await execute(value, api)

  expect(parseOutput(messages)).toEqual({
    error,
    hint: 'Open an HTML editor tab first. Pass its full URI when more than one HTML tab is open.',
    tool: 'open_html_preview',
  })
})

test('supports completed output items', async () => {
  const api = createApi(['file:///workspace/index.html'])

  await executePreviewFunctionToolCall(
    {
      item: {
        arguments: '{}',
        call_id: 'preview-call',
        name: 'open_html_preview',
        type: 'function_call',
      },
      type: 'response.output_item.done',
    },
    api,
  )

  expect(api.open).toHaveBeenCalledWith('file:///workspace/index.html')
})

test.each([
  undefined,
  null,
  {},
  {
    arguments: '{}',
    call_id: 'call',
    name: 'other',
    type: 'response.function_call_arguments.done',
  },
] as const)('ignores unrelated events %#', async (event) => {
  await expect(executePreviewFunctionToolCall(event)).resolves.toBeUndefined()
})
