import {
  type VirtualDomNode,
  text,
  VirtualDomElements,
} from '@lvce-editor/virtual-dom-worker'
import type { IToolCallMessage } from '../CreateInstance/CreateInstance.ts'
import * as ClassNames from '../ClassNames/ClassNames.ts'
import * as DomEventListenerFunctions from '../DomEventListenerFunctions/DomEventListenerFunctions.ts'
import { getToolCallStatusIcon } from '../GetToolCallStatusIcon/GetToolCallStatusIcon.ts'
import { getToolCallSummary } from '../GetToolCallSummary/GetToolCallSummary.ts'
import * as MergeClassNames from '../MergeClassNames/MergeClassNames.ts'
import { renderToolCallDetails } from '../RenderToolCallDetails/RenderToolCallDetails.ts'

export const renderToolCall = (
  item: IToolCallMessage,
): readonly VirtualDomNode[] => {
  return [
    {
      childCount: item.expanded ? 2 : 1,
      className: MergeClassNames.mergeClassNames(
        ClassNames.GptVoiceToolCall,
        item.status,
      ),
      type: VirtualDomElements.Div,
    },
    {
      ariaExpanded: item.expanded,
      childCount: 3,
      className: ClassNames.GptVoiceToolCallButton,
      name: item.id,
      onClick: DomEventListenerFunctions.ToggleToolCall,
      type: VirtualDomElements.Button,
    },
    {
      childCount: 1,
      className: ClassNames.GptVoiceToolCallStatus,
      name: item.id,
      type: VirtualDomElements.Span,
    },
    text(getToolCallStatusIcon(item)),
    {
      childCount: 1,
      className: ClassNames.GptVoiceToolCallSummary,
      name: item.id,
      type: VirtualDomElements.Span,
    },
    text(getToolCallSummary(item)),
    {
      childCount: 1,
      className: ClassNames.GptVoiceToolCallChevron,
      name: item.id,
      type: VirtualDomElements.Span,
    },
    text(item.expanded ? '⌃' : '⌄'),
    ...renderToolCallDetails(item),
  ]
}
