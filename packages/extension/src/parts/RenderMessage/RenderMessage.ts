import type { VirtualDomNode } from '@lvce-editor/virtual-dom-worker'
import type { IMessage } from '../CreateInstance/CreateInstance.ts'
import { renderToolCall } from '../RenderToolCall/RenderToolCall.ts'
import { renderTranscriptItem } from '../RenderTranscriptItem/RenderTranscriptItem.ts'

export const renderMessage = (item: IMessage): readonly VirtualDomNode[] => {
  if (item.type === 'tool') {
    return renderToolCall(item)
  }
  return renderTranscriptItem(item)
}
