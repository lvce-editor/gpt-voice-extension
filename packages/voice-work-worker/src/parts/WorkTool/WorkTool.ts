import type { FunctionToolDefinition } from 'voice-shared'

export const doWorkTool: FunctionToolDefinition = {
  description:
    'Delegate substantive work to the coding worker. Call this whenever the user asks to create, modify, inspect, debug, test, run, open, configure, or otherwise perform work in the editor or workspace. Pass the complete user request. Wait for the result, then briefly narrate whether it succeeded and summarize what was done.',
  name: 'do_work',
  parameters: {
    additionalProperties: false,
    properties: {
      task: {
        description:
          'The complete work request, preserving filenames, constraints, and requested validation.',
        type: 'string',
      },
    },
    required: ['task'],
    type: 'object',
  },
  type: 'function',
}
