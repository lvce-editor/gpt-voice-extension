import {
  type VirtualDomNode,
  text,
  VirtualDomElements,
} from '@lvce-editor/virtual-dom-worker'
import * as ClassNames from '../ClassNames/ClassNames.ts'
import { formatToolCallValue } from '../ToolCall/ToolCall.ts'

const toolCallSectionNode: VirtualDomNode = {
  childCount: 2,
  className: ClassNames.GptVoiceToolCallSection,
  type: VirtualDomElements.Div,
}

const toolCallLabelNode: VirtualDomNode = {
  childCount: 1,
  className: ClassNames.GptVoiceToolCallLabel,
  type: VirtualDomElements.Div,
}

const toolCallValueNode: VirtualDomNode = {
  childCount: 1,
  className: ClassNames.GptVoiceToolCallValue,
  type: VirtualDomElements.Pre,
}

export const renderToolCallSection = (
  label: string,
  value: string,
): readonly VirtualDomNode[] => {
  return [
    toolCallSectionNode,
    toolCallLabelNode,
    text(label),
    toolCallValueNode,
    text(formatToolCallValue(value)),
  ]
}
