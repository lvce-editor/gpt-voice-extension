import { expect, jest, test } from '@jest/globals'
import {
  executePanelViewFunctionToolCall,
  panelViewFunctionTools,
} from '../src/parts/PanelViewFunctionTools/PanelViewFunctionTools.ts'

const getToolOutput = (messages: readonly string[]): unknown => {
  const message = JSON.parse(messages[0] || '{}')
  return JSON.parse(message.item.output)
}

const createApi: () => {
  readonly openDebugConsole: ReturnType<
    typeof jest.fn<(options: { readonly input?: string }) => Promise<void>>
  >
  readonly openOutputView: ReturnType<
    typeof jest.fn<(options: { readonly channel?: string }) => Promise<void>>
  >
  readonly openProblemsView: ReturnType<
    typeof jest.fn<(options: { readonly filter?: string }) => Promise<void>>
  >
} = () => ({
  openDebugConsole: jest.fn<
    (options: { readonly input?: string }) => Promise<void>
  >(async () => undefined),
  openOutputView: jest.fn<
    (options: { readonly channel?: string }) => Promise<void>
  >(async () => undefined),
  openProblemsView: jest.fn<
    (options: { readonly filter?: string }) => Promise<void>
  >(async () => undefined),
})

const createFunctionCall = (
  name: string,
  argumentsValue: string,
): Readonly<Record<string, string>> => ({
  arguments: argumentsValue,
  call_id: 'panel-view-call',
  name,
  type: 'response.function_call_arguments.done',
})

test('exposes dedicated panel view tool definitions', () => {
  expect(panelViewFunctionTools.map(({ name }) => name)).toEqual([
    'open_problems_view',
    'open_output_view',
    'open_debug_console',
  ])
})

test('opens Problems with an initial filter', async () => {
  const api = createApi()
  const messages = await executePanelViewFunctionToolCall(
    createFunctionCall('open_problems_view', '{"filter":"typescript"}'),
    api,
  )

  expect(api.openProblemsView).toHaveBeenCalledWith({ filter: 'typescript' })
  expect(getToolOutput(messages || [])).toEqual({
    filter: 'typescript',
    opened: true,
  })
})

test.each([
  ['main-process', 'MainProcess'],
  ['shared-process', 'SharedProcess'],
  ['window', 'Window'],
  ['eslint', 'eslint'],
])('opens Output channel %s using id %s', async (channel, channelId) => {
  const api = createApi()
  const messages = await executePanelViewFunctionToolCall(
    createFunctionCall('open_output_view', JSON.stringify({ channel })),
    api,
  )

  expect(api.openOutputView).toHaveBeenCalledWith({ channel: channelId })
  expect(getToolOutput(messages || [])).toEqual({ channel, opened: true })
})

test('opens Debug Console with initial input', async () => {
  const api = createApi()
  const messages = await executePanelViewFunctionToolCall(
    {
      item: {
        arguments: '{"input":"process.version"}',
        call_id: 'panel-view-call',
        name: 'open_debug_console',
        type: 'function_call',
      },
      type: 'response.output_item.done',
    },
    api,
  )

  expect(api.openDebugConsole).toHaveBeenCalledWith({
    input: 'process.version',
  })
  expect(getToolOutput(messages || [])).toEqual({
    input: 'process.version',
    opened: true,
  })
})

test.each([
  ['open_problems_view', 'openProblemsView'],
  ['open_output_view', 'openOutputView'],
  ['open_debug_console', 'openDebugConsole'],
] as const)(
  'preserves current view options for %s',
  async (name, apiMethod) => {
    const api = createApi()
    const messages = await executePanelViewFunctionToolCall(
      createFunctionCall(name, '{}'),
      api,
    )

    expect(api[apiMethod]).toHaveBeenCalledWith({})
    expect(getToolOutput(messages || [])).toEqual({ opened: true })
  },
)

test.each([
  ['open_problems_view', '{"filter":1}', 'filter'],
  ['open_output_view', '{"channel":false}', 'channel'],
  ['open_debug_console', '{"input":[]}', 'input'],
])(
  'returns invalid %s options to the model',
  async (name, argumentsValue, option) => {
    const api = createApi()
    const messages = await executePanelViewFunctionToolCall(
      createFunctionCall(name, argumentsValue),
      api,
    )

    expect(getToolOutput(messages || [])).toEqual({
      error: `Function tool argument "${option}" must be a string.`,
      hint: 'Pass an object with an optional string option supported by this panel view tool.',
      tool: name,
    })
  },
)

test('returns API failures to the model', async () => {
  const api = createApi()
  api.openProblemsView.mockRejectedValue(new Error('Problems unavailable'))
  const messages = await executePanelViewFunctionToolCall(
    createFunctionCall('open_problems_view', '{}'),
    api,
  )

  expect(getToolOutput(messages || [])).toEqual({
    error: 'Problems unavailable',
    hint: 'Pass an object with an optional string option supported by this panel view tool.',
    tool: 'open_problems_view',
  })
})

const nonPanelViewFunctionCalls: readonly unknown[] = [
  undefined,
  null,
  {},
  {
    arguments: '{}',
    call_id: 'panel-view-call',
    name: 'open_problems_view',
    type: 'other',
  },
  {
    item: {
      arguments: '{}',
      call_id: 'panel-view-call',
      name: 'open_problems_view',
      type: 'message',
    },
    type: 'response.output_item.done',
  },
  createFunctionCall('read_workspace_file', '{}'),
]

test.each(nonPanelViewFunctionCalls)(
  'ignores non-panel-view function call %#',
  async (event) => {
    await expect(
      executePanelViewFunctionToolCall(event),
    ).resolves.toBeUndefined()
  },
)
