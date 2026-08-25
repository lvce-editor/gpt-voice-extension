import { test, expect } from '@jest/globals'
import { text, VirtualDomElements } from '@lvce-editor/virtual-dom-worker'
import * as DomEventListenerFunctions from '../src/parts/DomEventListenerFunctions/DomEventListenerFunctions.ts'
import { mergeClassNames } from '../src/parts/MergeClassNames/MergeClassNames.ts'
import { RealtimeModelPreset } from '../src/parts/RealtimeModelPreset/RealtimeModelPreset.ts'
import { renderModelSettings } from '../src/parts/RenderModelSettings/RenderModelSettings.ts'

test('renderModelSettings - mini model is selected', () => {
  const result = renderModelSettings({
    sessionModel: RealtimeModelPreset.Mini,
  })

  expect(result).toEqual([
    {
      childCount: 3,
      className: 'GptVoiceModelSettings',
      type: VirtualDomElements.Div,
    },
    {
      childCount: 1,
      className: 'GptVoiceModelSettingsLabel',
      type: VirtualDomElements.Div,
    },
    text('Model: Realtime 2.1 mini (cheaper)'),
    {
      childCount: 1,
      className: mergeClassNames('GptVoiceModelButton', 'active'),
      onClick: DomEventListenerFunctions.SetRealtimeModelMini,
      type: VirtualDomElements.Button,
    },
    text('Use cheap'),
    {
      childCount: 1,
      className: 'GptVoiceModelButton',
      onClick: DomEventListenerFunctions.SetRealtimeModelStandard,
      type: VirtualDomElements.Button,
    },
    text('Use better'),
  ])
})

test('renderModelSettings - standard model is selected', () => {
  const result = renderModelSettings({
    sessionModel: RealtimeModelPreset.Standard,
  })

  expect(result).toEqual([
    {
      childCount: 3,
      className: 'GptVoiceModelSettings',
      type: VirtualDomElements.Div,
    },
    {
      childCount: 1,
      className: 'GptVoiceModelSettingsLabel',
      type: VirtualDomElements.Div,
    },
    text('Model: Realtime 2.1 (better quality)'),
    {
      childCount: 1,
      className: 'GptVoiceModelButton',
      onClick: DomEventListenerFunctions.SetRealtimeModelMini,
      type: VirtualDomElements.Button,
    },
    text('Use cheap'),
    {
      childCount: 1,
      className: mergeClassNames('GptVoiceModelButton', 'active'),
      onClick: DomEventListenerFunctions.SetRealtimeModelStandard,
      type: VirtualDomElements.Button,
    },
    text('Use better'),
  ])
})
