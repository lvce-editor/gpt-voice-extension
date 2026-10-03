import {
  type VirtualDomNode,
  VirtualDomElements,
} from '@lvce-editor/virtual-dom-worker'
import type { IState } from '../CreateInstance/CreateInstance.ts'
import * as ClassNames from '../ClassNames/ClassNames.ts'
import * as MergeClassNames from '../MergeClassNames/MergeClassNames.ts'

const stageNode: VirtualDomNode = {
  childCount: 1,
  className: ClassNames.GptVoiceStage,
  type: VirtualDomElements.Div,
}

const listeningBubbleClassName = MergeClassNames.mergeClassNames(
  ClassNames.GptVoiceBubble,
  ClassNames.Listening,
)

const getBubbleClassName = (inProgress: boolean): string => {
  if (inProgress) {
    return listeningBubbleClassName
  }
  return ClassNames.GptVoiceBubble
}
export const renderStage = (state: IState): readonly VirtualDomNode[] => {
  const { inProgress } = state
  return [
    stageNode,
    {
      childCount: 0,
      className: getBubbleClassName(inProgress),
      type: VirtualDomElements.Div,
    },
  ]
}
