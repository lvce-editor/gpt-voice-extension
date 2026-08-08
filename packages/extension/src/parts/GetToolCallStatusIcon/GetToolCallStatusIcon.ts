import type { IToolCallMessage } from '../CreateInstance/CreateInstance.ts'

export const getToolCallStatusIcon = (item: IToolCallMessage): string => {
  if (item.status === 'failed') {
    return '!'
  }
  if (item.status === 'in-progress') {
    return '●'
  }
  return '✓'
}
