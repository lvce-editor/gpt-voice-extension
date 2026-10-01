import { expect, jest, test } from '@jest/globals'
import {
  executeComputerUseFunctionTool,
  getComputerUseFunctionTools,
} from '../src/parts/ComputerUseFunctionTools/ComputerUseFunctionTools.ts'

test('converts MCP tools to prefixed function definitions', () => {
  const tools = getComputerUseFunctionTools([
    {
      inputSchema: { properties: {}, type: 'object' },
      name: 'list_windows',
    },
  ])

  expect(tools).toEqual([
    {
      description: 'Use the Linux desktop tool list_windows.',
      name: 'computer_use_list_windows',
      parameters: { properties: {}, type: 'object' },
      type: 'function',
    },
  ])
})

test('passes text and image results through for work model conversion', async () => {
  const callTool = jest.fn(
    async (
      _name: string,
      _argumentsValue: Readonly<Record<string, unknown>>,
    ) => ({
      content: [
        { text: 'Window: editor', type: 'text' },
        { data: 'cG5n', mimeType: 'image/png', type: 'image' },
      ],
    }),
  )

  await expect(
    executeComputerUseFunctionTool(
      'computer_use_get_app_state',
      '{"app":"editor"}',
      { callTool },
    ),
  ).resolves.toEqual({
    images: [{ data: 'cG5n', mimeType: 'image/png' }],
    text: 'Window: editor',
    type: 'computer_use_result',
  })
  expect(callTool).toHaveBeenCalledWith('get_app_state', { app: 'editor' })
})

test('returns malformed arguments and backend failures as tool results', async () => {
  const callTool = jest.fn(
    async (
      _name: string,
      _argumentsValue: Readonly<Record<string, unknown>>,
    ) => {
      throw new Error('desktop service unavailable')
    },
  )

  await expect(
    executeComputerUseFunctionTool('computer_use_click', '[]', { callTool }),
  ).resolves.toMatchObject({
    error: 'Computer-use function arguments must be a JSON object.',
  })
  await expect(
    executeComputerUseFunctionTool('computer_use_click', '{}', { callTool }),
  ).resolves.toMatchObject({ error: 'desktop service unavailable' })
})
