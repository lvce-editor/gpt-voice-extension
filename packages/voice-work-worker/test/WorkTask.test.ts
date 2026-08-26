import { afterEach, beforeEach, expect, jest, test } from '@jest/globals'

const invoke =
  jest.fn<(method: string, ...params: readonly unknown[]) => Promise<unknown>>()

// eslint-disable-next-line jest/no-restricted-jest-methods
jest.unstable_mockModule('../src/parts/Rpc/Rpc.ts', () => ({ invoke }))

const WorkTask = await import('../src/parts/WorkTask/WorkTask.ts')

const configuration = {
  accessToken: 'access-token',
  endpoint: 'https://api.openai.com/v1/responses',
}

const tools = [
  {
    description: 'Read a file',
    name: 'read_workspace_file',
    parameters: { type: 'object' },
    type: 'function' as const,
  },
]

const jsonResponse = (data: unknown, ok = true, status = 200): Response =>
  ({
    json: async () => data,
    ok,
    status,
  }) as Response

beforeEach(() => {
  invoke.mockReset().mockResolvedValue('{"content":"old"}')
})

afterEach(() => {
  jest.restoreAllMocks()
})

test('uses GPT-5.6 Luna to execute tools and returns a structured summary', async () => {
  const fetch = jest
    .spyOn(globalThis, 'fetch')
    .mockResolvedValueOnce(
      jsonResponse({
        output: [
          {
            arguments: '{"path":"index.html"}',
            call_id: 'call-1',
            name: 'read_workspace_file',
            status: 'completed',
            type: 'function_call',
          },
        ],
        status: 'completed',
      }),
    )
    .mockResolvedValueOnce(
      jsonResponse({
        output: [
          {
            content: [
              {
                text: '{"success":true,"summary":"Created the mountain scene."}',
                type: 'output_text',
              },
            ],
            role: 'assistant',
            type: 'message',
          },
        ],
        status: 'completed',
      }),
    )

  await expect(
    WorkTask.execute({
      configuration,
      task: 'Create a mountain scene',
      tools,
      workId: 7,
    }),
  ).resolves.toEqual({
    success: true,
    summary: 'Created the mountain scene.',
  })

  expect(invoke).toHaveBeenCalledWith(
    'VoiceWorkHost.executeFunctionTool',
    'read_workspace_file',
    '{"path":"index.html"}',
  )
  expect(invoke).toHaveBeenCalledWith('VoiceWorkHost.reportToolCall', 7, {
    argumentsValue: '{"path":"index.html"}',
    callId: 'call-1',
    name: 'read_workspace_file',
    type: 'started',
  })
  expect(invoke).toHaveBeenCalledWith('VoiceWorkHost.reportToolCall', 7, {
    callId: 'call-1',
    output: '{"content":"old"}',
    type: 'completed',
  })
  const firstRequestBody = fetch.mock.calls[0]?.[1]?.body
  expect(typeof firstRequestBody).toBe('string')
  const firstRequest = JSON.parse(firstRequestBody as string)
  expect(firstRequest).toEqual(
    expect.objectContaining({
      max_tool_calls: 50,
      model: 'gpt-5.6-luna',
      parallel_tool_calls: false,
      reasoning: { effort: 'medium' },
      store: false,
      tool_choice: 'auto',
      tools,
    }),
  )
  expect(firstRequest.instructions).toContain(
    "Complete the user's entire task autonomously",
  )
  expect(firstRequest.text.format).toEqual(
    expect.objectContaining({
      name: 'voice_work_result',
      strict: true,
      type: 'json_schema',
    }),
  )
  const secondRequestBody = fetch.mock.calls[1]?.[1]?.body
  expect(typeof secondRequestBody).toBe('string')
  const secondRequest = JSON.parse(secondRequestBody as string)
  expect(secondRequest.input).toContainEqual({
    call_id: 'call-1',
    output: '{"content":"old"}',
    type: 'function_call_output',
  })
})

test('accepts top-level output_text and trims the result', async () => {
  jest.spyOn(globalThis, 'fetch').mockResolvedValue(
    jsonResponse({
      output: [],
      output_text: '{"success":true,"summary":"  Finished.  "}',
      status: 'completed',
    }),
  )

  await expect(
    WorkTask.execute({ configuration, task: 'Do it', tools: [], workId: 1 }),
  ).resolves.toEqual({ success: true, summary: 'Finished.' })
})

test('returns tool failures to the model so it can recover', async () => {
  invoke.mockRejectedValue(new Error('file was locked'))
  const fetch = jest
    .spyOn(globalThis, 'fetch')
    .mockResolvedValueOnce(
      jsonResponse({
        output: [
          {
            arguments: '{}',
            call_id: 'call-1',
            name: 'read_workspace_file',
            type: 'function_call',
          },
        ],
        status: 'completed',
      }),
    )
    .mockResolvedValueOnce(
      jsonResponse({
        output: [],
        output_text: '{"success":false,"summary":"The file remained locked."}',
        status: 'completed',
      }),
    )

  await expect(
    WorkTask.execute({ configuration, task: 'Read it', tools, workId: 1 }),
  ).resolves.toEqual({
    success: false,
    summary: 'The file remained locked.',
  })
  const continuationBody = fetch.mock.calls[1]?.[1]?.body
  expect(typeof continuationBody).toBe('string')
  const continuation = JSON.parse(continuationBody as string)
  expect(continuation.input).toContainEqual({
    call_id: 'call-1',
    output: '{"error":"file was locked","success":false}',
    type: 'function_call_output',
  })
})

test.each([
  [
    jsonResponse({ error: { message: 'rate limited' } }, false, 429),
    'rate limited',
  ],
  [jsonResponse({ error: 'plan required' }, false, 403), 'plan required'],
  [jsonResponse(null, false, 502), 'Coding request failed (502).'],
] as const)(
  'returns API failures as work results',
  async (response, summary) => {
    jest.spyOn(globalThis, 'fetch').mockResolvedValue(response)

    await expect(
      WorkTask.execute({ configuration, task: 'Do it', tools: [], workId: 1 }),
    ).resolves.toEqual({ success: false, summary })
  },
)

test('returns invalid JSON response failures', async () => {
  jest.spyOn(globalThis, 'fetch').mockResolvedValue({
    json: async () => {
      throw new Error('invalid json')
    },
    ok: false,
    status: 502,
  } as unknown as Response)

  await expect(
    WorkTask.execute({ configuration, task: 'Do it', tools: [], workId: 1 }),
  ).resolves.toEqual({
    success: false,
    summary: 'Coding request failed (502).',
  })
})

test.each([
  [
    { configuration, task: ' ', tools: [], workId: 1 },
    'The delegated task must not be empty.',
  ],
  [
    {
      configuration: { accessToken: '', endpoint: '' },
      task: 'Do it',
      tools: [],
      workId: 1,
    },
    'Coding model authentication is unavailable.',
  ],
] as const)(
  'validates work options',
  async (
    options: Readonly<Parameters<typeof WorkTask.execute>[0]>,
    summary: string,
  ) => {
    await expect(WorkTask.execute(options)).resolves.toEqual({
      success: false,
      summary,
    })
  },
)

test('reports incomplete and malformed model completions', async () => {
  jest
    .spyOn(globalThis, 'fetch')
    .mockResolvedValueOnce(
      jsonResponse({
        error: { message: 'output token limit reached' },
        output: [],
        status: 'incomplete',
      }),
    )
    .mockResolvedValueOnce(jsonResponse({ output: [], status: 'completed' }))

  await expect(
    WorkTask.execute({ configuration, task: 'First', tools: [], workId: 1 }),
  ).resolves.toEqual({
    success: false,
    summary: 'output token limit reached',
  })
  await expect(
    WorkTask.execute({ configuration, task: 'Second', tools: [], workId: 1 }),
  ).resolves.toEqual({
    success: false,
    summary: 'The coding model returned an invalid completion summary.',
  })
})
