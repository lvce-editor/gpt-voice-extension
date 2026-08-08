import { executeRegisteredFunctionTool } from '../FunctionToolRegistry/FunctionToolRegistry.ts'
import { executePanelFunctionToolCall } from '../PanelFunctionTools/PanelFunctionTools.ts'
import { executeTerminalFunctionToolCall } from '../TerminalFunctionTools/TerminalFunctionTools.ts'
import { executeWorkspaceFileFunctionToolCall } from '../WorkspaceFileFunctionTools/WorkspaceFileFunctionTools.ts'
import { executeWorkspaceFunctionToolCall } from '../WorkspaceFunctionTools/WorkspaceFunctionTools.ts'

interface FunctionCallArguments {
  readonly argumentsValue: string
  readonly callId: string
  readonly name: string
}

const createToolOutputMessage = (callId: string, output: string): string => {
  return JSON.stringify({
    item: {
      call_id: callId,
      output,
      type: 'function_call_output',
    },
    type: 'conversation.item.create',
  })
}

const createFunctionResultResponseMessage = (): string => {
  return JSON.stringify({
    type: 'response.create',
  })
}

const parseFunctionCall = (
  parsed: unknown,
): FunctionCallArguments | undefined => {
  if (!parsed || typeof parsed !== 'object') {
    return undefined
  }

  if (
    'type' in parsed &&
    parsed.type === 'response.function_call_arguments.done'
  ) {
    if (
      'call_id' in parsed &&
      typeof parsed.call_id === 'string' &&
      'name' in parsed &&
      typeof parsed.name === 'string' &&
      'arguments' in parsed &&
      typeof parsed.arguments === 'string'
    ) {
      return {
        argumentsValue: parsed.arguments,
        callId: parsed.call_id,
        name: parsed.name,
      }
    }
    return undefined
  }

  if (
    'type' in parsed &&
    parsed.type === 'response.output_item.done' &&
    'item' in parsed &&
    parsed.item &&
    typeof parsed.item === 'object' &&
    'type' in parsed.item &&
    parsed.item.type === 'function_call' &&
    'call_id' in parsed.item &&
    typeof parsed.item.call_id === 'string' &&
    'name' in parsed.item &&
    typeof parsed.item.name === 'string' &&
    'arguments' in parsed.item &&
    typeof parsed.item.arguments === 'string'
  ) {
    return {
      argumentsValue: parsed.item.arguments,
      callId: parsed.item.call_id,
      name: parsed.item.name,
    }
  }

  return undefined
}

export const executeFunctionToolCall = async (
  parsed: unknown,
): Promise<readonly string[]> => {
  const panelMessages = await executePanelFunctionToolCall(parsed)
  if (panelMessages) {
    return panelMessages
  }
  const workspaceMessages = await executeWorkspaceFunctionToolCall(parsed)
  if (workspaceMessages) {
    return workspaceMessages
  }
  const workspaceFileMessages =
    await executeWorkspaceFileFunctionToolCall(parsed)
  if (workspaceFileMessages) {
    return workspaceFileMessages
  }
  const terminalMessages = await executeTerminalFunctionToolCall(parsed)
  if (terminalMessages) {
    return terminalMessages
  }
  const functionCall = parseFunctionCall(parsed)
  if (!functionCall) {
    return []
  }

  const result = executeRegisteredFunctionTool(
    functionCall.name,
    functionCall.argumentsValue,
  )
  const outputMessage = createToolOutputMessage(
    functionCall.callId,
    JSON.stringify(result),
  )
  if (functionCall.name === 'wait_for_user') {
    return [outputMessage]
  }
  return [outputMessage, createFunctionResultResponseMessage()]
}
