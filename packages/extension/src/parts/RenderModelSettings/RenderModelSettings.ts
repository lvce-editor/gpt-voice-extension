import {
  type VirtualDomNode,
  text,
  VirtualDomElements,
} from '@lvce-editor/virtual-dom-worker'
import * as ClassNames from '../ClassNames/ClassNames.ts'
import * as DomEventListenerFunctions from '../DomEventListenerFunctions/DomEventListenerFunctions.ts'
import * as GptVoiceStrings from '../GptVoiceStrings/GptVoiceStrings.ts'
import * as MergeClassNames from '../MergeClassNames/MergeClassNames.ts'
import { RealtimeModelPreset } from '../RealtimeModelPreset/RealtimeModelPreset.ts'

const modelSettingsNode: VirtualDomNode = {
  childCount: 3,
  className: ClassNames.GptVoiceModelSettings,
  type: VirtualDomElements.Div,
}

const modelSettingsLabelNode: VirtualDomNode = {
  childCount: 1,
  className: ClassNames.GptVoiceModelSettingsLabel,
  type: VirtualDomElements.Div,
}

export const renderModelSettings = (
  state: Readonly<{ sessionModel: RealtimeModelPreset }>,
): readonly VirtualDomNode[] => {
  const { sessionModel } = state
  return [
    modelSettingsNode,
    modelSettingsLabelNode,
    text(
      sessionModel === RealtimeModelPreset.Mini
        ? GptVoiceStrings.realtimeMiniModel()
        : GptVoiceStrings.realtimeStandardModel(),
    ),
    {
      childCount: 1,
      className:
        sessionModel === RealtimeModelPreset.Mini
          ? MergeClassNames.mergeClassNames(
              ClassNames.GptVoiceModelButton,
              ClassNames.Active,
            )
          : ClassNames.GptVoiceModelButton,
      onClick: DomEventListenerFunctions.SetRealtimeModelMini,
      type: VirtualDomElements.Button,
    },
    text(GptVoiceStrings.useCheap()),
    {
      childCount: 1,
      className:
        sessionModel === RealtimeModelPreset.Standard
          ? MergeClassNames.mergeClassNames(
              ClassNames.GptVoiceModelButton,
              ClassNames.Active,
            )
          : ClassNames.GptVoiceModelButton,
      onClick: DomEventListenerFunctions.SetRealtimeModelStandard,
      type: VirtualDomElements.Button,
    },
    text(GptVoiceStrings.useBetter()),
  ]
}
