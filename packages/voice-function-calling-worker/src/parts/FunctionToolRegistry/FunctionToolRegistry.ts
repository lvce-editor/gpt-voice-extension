import { getFakeWeather } from '../FakeWeather/FakeWeather.ts'
import { panelFunctionTools } from '../PanelFunctionTools/PanelFunctionTools.ts'
import { panelViewFunctionTools } from '../PanelViewFunctionTools/PanelViewFunctionTools.ts'
import { workspaceFileFunctionTools } from '../WorkspaceFileFunctionTools/WorkspaceFileFunctionTools.ts'
import { workspaceFunctionTools } from '../WorkspaceFunctionTools/WorkspaceFunctionTools.ts'

export interface FunctionToolDefinition {
  readonly description: string
  readonly name: string
  readonly parameters: Readonly<Record<string, unknown>>
  readonly type: 'function'
}

interface RegisteredFunctionTool {
  readonly definition: FunctionToolDefinition
  readonly execute: (
    argumentsValue: Readonly<Record<string, unknown>>,
  ) => unknown
}

const getWeatherTool: RegisteredFunctionTool = {
  definition: {
    description: 'Get weather for a location.',
    name: 'getweather',
    parameters: {
      additionalProperties: false,
      properties: {
        location: {
          description: 'Location to get the weather for',
          type: 'string',
        },
      },
      required: ['location'],
      type: 'object',
    },
    type: 'function',
  },
  execute(argumentsValue) {
    return getFakeWeather(argumentsValue.location)
  },
}

const stopTalkingTool: RegisteredFunctionTool = {
  definition: {
    description:
      'Stop the voice conversation immediately when the user asks you to stop talking or end the conversation.',
    name: 'stop_talking',
    parameters: {
      additionalProperties: false,
      properties: {},
      type: 'object',
    },
    type: 'function',
  },
  execute() {
    return { stopped: true }
  },
}

const registeredTools: readonly RegisteredFunctionTool[] = [
  getWeatherTool,
  stopTalkingTool,
]

const parseArguments = (value: string): Readonly<Record<string, unknown>> => {
  const parsed: unknown = JSON.parse(value)
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new TypeError('Function tool arguments must be a JSON object')
  }
  return parsed as Readonly<Record<string, unknown>>
}

export const getRegisteredTools = (): readonly FunctionToolDefinition[] => {
  return [
    ...registeredTools.map((tool) => tool.definition),
    ...panelFunctionTools,
    ...panelViewFunctionTools,
    ...workspaceFunctionTools,
    ...workspaceFileFunctionTools,
  ]
}

export const executeRegisteredFunctionTool = (
  name: string,
  argumentsValue: string,
): unknown => {
  const tool = registeredTools.find((tool) => tool.definition.name === name)
  if (!tool) {
    throw new Error(`Unknown function tool: ${name}`)
  }
  return tool.execute(parseArguments(argumentsValue))
}
