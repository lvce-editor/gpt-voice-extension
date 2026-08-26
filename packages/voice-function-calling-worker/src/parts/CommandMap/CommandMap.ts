import * as FunctionCalling from '../FunctionCalling/FunctionCalling.ts'
import * as FunctionToolRegistry from '../FunctionToolRegistry/FunctionToolRegistry.ts'

export const commandMap: Readonly<Record<string, unknown>> = {
  'VoiceFunctionCalling.executeFunctionTool':
    FunctionCalling.executeFunctionTool,
  'VoiceFunctionCalling.executeFunctionToolCall':
    FunctionCalling.executeFunctionToolCall,
  'VoiceFunctionCalling.getRealtimeTools':
    FunctionToolRegistry.getRealtimeTools,
  'VoiceFunctionCalling.getRegisteredTools':
    FunctionToolRegistry.getRegisteredTools,
  'VoiceFunctionCalling.getWorkTools': FunctionToolRegistry.getWorkTools,
}
