import type { IToolCallMessage } from '../CreateInstance/CreateInstance.ts'

export const getToolCallSummary = (item: IToolCallMessage): string => {
  if (item.status === 'failed') {
    return `Failed ${item.name}`
  }
  if (item.status === 'in-progress') {
    return `Running ${item.name}…`
  }
  return `Ran ${item.name}`
}
