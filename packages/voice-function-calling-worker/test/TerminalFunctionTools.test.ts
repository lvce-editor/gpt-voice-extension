import { expect, jest, test } from '@jest/globals'
import {
  executeTerminalFunctionToolCall,
  terminalFunctionTools,
} from '../src/parts/TerminalFunctionTools/TerminalFunctionTools.ts'

const getOutput = (messages: readonly string[]): unknown => {
  const message = JSON.parse(messages[0] || '{}')
  return JSON.parse(message.item.output)
}

test('declares background and integrated terminal command tools', () => {
  expect(terminalFunctionTools).toEqual([
    expect.objectContaining({ name: 'execute_bash', type: 'function' }),
    expect.objectContaining({ name: 'run_in_terminal', type: 'function' }),
  ])
  const executeBashDefinition = terminalFunctionTools[0]
  expect(executeBashDefinition?.parameters).toEqual(
    expect.objectContaining({ required: ['command'] }),
  )
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
  const runInTerminal = jest.fn<(command: string) => Promise<undefined>>(
    async () => undefined,
  )

  const messages = await executeTerminalFunctionToolCall(
    {
      arguments: '{"command":"npm test"}',
      call_id: 'terminal-call',
      name: 'execute_bash',
      type: 'response.function_call_arguments.done',
    },
    { executeBash, runInTerminal },
  )

  expect(executeBash).toHaveBeenCalledWith('npm test')
  expect(getOutput(messages || [])).toEqual(result)
  expect(JSON.parse(messages?.[1] || '{}')).toEqual({ type: 'response.create' })
})

test('runs a command in the integrated terminal', async () => {
  const executeBash = jest.fn<(command: string) => Promise<undefined>>(
    async () => undefined,
  )
  const result = { command: 'echo hello world', success: true }
  const runInTerminal = jest.fn<(command: string) => Promise<typeof result>>(
    async () => result,
  )

  const messages = await executeTerminalFunctionToolCall(
    {
      arguments: '{"command":"echo hello world"}',
      call_id: 'terminal-call',
      name: 'run_in_terminal',
      type: 'response.function_call_arguments.done',
    },
    { executeBash, runInTerminal },
  )

  expect(runInTerminal).toHaveBeenCalledWith('echo hello world')
  expect(executeBash).not.toHaveBeenCalled()
  expect(getOutput(messages || [])).toEqual(result)
})

test('returns a useful error for invalid arguments', async () => {
  const executeBash = jest.fn<(command: string) => Promise<undefined>>(
    async () => undefined,
  )
  const runInTerminal = jest.fn<(command: string) => Promise<undefined>>(
    async () => undefined,
  )

  const messages = await executeTerminalFunctionToolCall(
    {
      arguments: '{"command":""}',
      call_id: 'terminal-call',
      name: 'execute_bash',
      type: 'response.function_call_arguments.done',
    },
    { executeBash, runInTerminal },
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
