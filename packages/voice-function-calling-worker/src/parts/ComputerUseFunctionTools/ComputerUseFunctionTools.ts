import type { FunctionToolDefinition } from '../FunctionToolRegistry/FunctionToolRegistry.ts'

interface McpTool {
  readonly description?: string
  readonly inputSchema: Readonly<Record<string, unknown>>
  readonly name: string
}

interface McpContent {
  readonly data?: string
  readonly mimeType?: string
  readonly text?: string
  readonly type: string
}

interface ComputerUseApi {
  readonly callTool: (
    name: string,
    argumentsValue: Readonly<Record<string, unknown>>,
  ) => Promise<unknown>
}

const prefix = 'computer_use_'
const toolNamePattern = /^[a-zA-Z0-9_-]+$/

const getToolName = (name: string): string => `${prefix}${name}`

export const getComputerUseFunctionTools = (
  tools: readonly McpTool[],
): readonly FunctionToolDefinition[] => {
  return tools
    .filter((tool) => toolNamePattern.test(tool.name))
    .map((tool) => ({
      description:
        tool.description ?? `Use the Linux desktop tool ${tool.name}.`,
      name: getToolName(tool.name),
      parameters: tool.inputSchema,
      type: 'function' as const,
    }))
}

const parseArguments = (value: string): Readonly<Record<string, unknown>> => {
  let parsed: unknown
  try {
    parsed = JSON.parse(value)
  } catch {
    throw new TypeError('Computer-use function arguments must be valid JSON.')
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new TypeError(
      'Computer-use function arguments must be a JSON object.',
    )
  }
  return parsed as Readonly<Record<string, unknown>>
}

const isImageContent = (
  content: McpContent,
): content is McpContent & { data: string; mimeType: string } => {
  return (
    content.type === 'image' &&
    typeof content.data === 'string' &&
    typeof content.mimeType === 'string'
  )
}

export const executeComputerUseFunctionTool = async (
  name: string,
  argumentsValue: string,
  api: ComputerUseApi,
): Promise<unknown> => {
  if (!name.startsWith(prefix)) return undefined
  const toolName = name.slice(prefix.length)
  try {
    const result = (await api.callTool(
      toolName,
      parseArguments(argumentsValue),
    )) as { content?: readonly McpContent[] }
    const content = Array.isArray(result?.content) ? result.content : []
    const text = content
      .filter((item) => item.type === 'text' && typeof item.text === 'string')
      .map((item) => item.text)
      .join('\n')
    const images = content
      .filter(isImageContent)
      .map(({ data, mimeType }) => ({ data, mimeType }))
    return { images, text, type: 'computer_use_result' }
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : String(error),
      hint: 'Enable gptvoice.tools.computerUseLinux.enabled on a supported Linux desktop and check the bundled computer-use-linux prerequisites.',
      tool: name,
    }
  }
}
