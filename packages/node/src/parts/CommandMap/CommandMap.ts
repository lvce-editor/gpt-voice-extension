import * as ComputerUse from '../ComputerUse/ComputerUse.ts'
import { executeBash } from '../ExecuteBash/ExecuteBash.ts'

export const commandMap: Readonly<Record<string, unknown>> = {
  'ComputerUse.callTool': ComputerUse.callTool,
  'ComputerUse.getTools': ComputerUse.getTools,
  'ComputerUse.stop': ComputerUse.stop,
  'Terminal.executeBash': executeBash,
}
