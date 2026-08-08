import { expect, jest, test } from '@jest/globals'
import {
  executeTerminalFunctionToolCall,
  terminalFunctionTools,
} from '../src/parts/TerminalFunctionTools/TerminalFunctionTools.ts'

const getOutput = (messages: readonly string[]): unknown => {
  const message = JSON.parse(messages[0] || '{}')
  return JSON.parse(message.item.output)
}

test('declares a Bash command tool', () => {
  expect(terminalFunctionTools).toEqual([
    expect.objectContaining({
      name: 'execute_bash',
      parameters: expect.objectContaining({ required: ['command'] }),
      type: 'function',
    }),
  ])
})

test('executes a Bash function call and returns its result', async () => {
  const result = {
    exitCode: 0,
    stderr: '',
    stdout: 'ok\n',
    timedOut: false,
  }
  const executeBash = jest.fn<(command: string) => Promise<typeof result>>(
    async () => result,
  )

  const messages = await executeTerminalFunctionToolCall(
    {
      arguments: '{"command":"npm test"}',
      call_id: 'terminal-call',
      name: 'execute_bash',
      type: 'response.function_call_arguments.done',
    },
    { executeBash },
  )

  expect(executeBash).toHaveBeenCalledWith('npm test')
  expect(getOutput(messages || [])).toEqual(result)
  expect(JSON.parse(messages?.[1] || '{}')).toEqual({ type: 'response.create' })
})

test('returns a useful error for invalid arguments', async () => {
  const executeBash = jest.fn<(command: string) => Promise<undefined>>(
    async () => undefined,
  )

  const messages = await executeTerminalFunctionToolCall(
    {
      arguments: '{"command":""}',
      call_id: 'terminal-call',
      name: 'execute_bash',
      type: 'response.function_call_arguments.done',
    },
    { executeBash },
  )

  expect(executeBash).not.toHaveBeenCalled()
  expect(getOutput(messages || [])).toEqual(
    expect.objectContaining({
      error: 'Function tool argument "command" must be a non-empty string.',
      tool: 'execute_bash',
    }),
  )
})

test('ignores unrelated function calls', async () => {
  await expect(
    executeTerminalFunctionToolCall({
      arguments: '{}',
      call_id: 'other-call',
      name: 'getweather',
      type: 'response.function_call_arguments.done',
    }),
  ).resolves.toBeUndefined()
})
