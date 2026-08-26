import * as WorkTask from '../WorkTask/WorkTask.ts'
import { doWorkTool } from '../WorkTool/WorkTool.ts'

export const commandMap: Readonly<Record<string, unknown>> = {
  'VoiceWork.execute': WorkTask.execute,
  'VoiceWork.getToolDefinition': () => doWorkTool,
}
