import {
  type VirtualDomNode,
  VirtualDomElements,
} from '@lvce-editor/virtual-dom-worker'
import type { IToolCallMessage } from '../CreateInstance/CreateInstance.ts'
import * as ClassNames from '../ClassNames/ClassNames.ts'
import { renderToolCallSection } from '../RenderToolCallSection/RenderToolCallSection.ts'

const toolCallDetailsNode: VirtualDomNode = {
  childCount: 2,
  className: ClassNames.GptVoiceToolCallDetails,
  type: VirtualDomElements.Div,
}

export const renderToolCallDetails = (
  item: IToolCallMessage,
): readonly VirtualDomNode[] => {
  if (!item.expanded) {
    return []
  }
  const output =
    item.status === 'in-progress' ? 'Waiting for tool output…' : item.output
  return [
    toolCallDetailsNode,
    ...renderToolCallSection('Arguments', item.argumentsValue),
    ...renderToolCallSection('Output', output),
  ]
}
