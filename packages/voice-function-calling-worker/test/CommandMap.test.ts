import { expect, test } from '@jest/globals'
import { commandMap } from '../src/parts/CommandMap/CommandMap.ts'
import * as FunctionCalling from '../src/parts/FunctionCalling/FunctionCalling.ts'
import * as FunctionToolRegistry from '../src/parts/FunctionToolRegistry/FunctionToolRegistry.ts'

test('exposes function calling RPC commands', () => {
  expect(commandMap).toEqual({
    'VoiceFunctionCalling.executeFunctionTool':
      FunctionCalling.executeFunctionTool,
    'VoiceFunctionCalling.executeFunctionToolCall':
      FunctionCalling.executeFunctionToolCall,
    'VoiceFunctionCalling.getRealtimeTools':
      FunctionToolRegistry.getRealtimeTools,
    'VoiceFunctionCalling.getRegisteredTools':
      FunctionToolRegistry.getRegisteredTools,
    'VoiceFunctionCalling.getWorkTools': FunctionToolRegistry.getWorkTools,
  })
})
