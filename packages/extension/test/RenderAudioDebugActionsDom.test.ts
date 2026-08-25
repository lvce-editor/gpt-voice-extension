import { expect, test } from '@jest/globals'
import {
  AriaRoles,
  mergeClassNames,
  VirtualDomElements,
} from '@lvce-editor/virtual-dom-worker'
import { renderAudioDebugActionsDom } from '../src/parts/RenderAudioDebugActionsDom/RenderAudioDebugActionsDom.ts'

test('renders refresh and settings actions', () => {
  expect(renderAudioDebugActionsDom()).toEqual([
    {
      ariaLabel: 'Voice audio recording actions',
      childCount: 2,
      className: 'Actions',
      role: AriaRoles.ToolBar,
      type: VirtualDomElements.Div,
    },
    {
      ariaLabel: 'Refresh Recordings',
      childCount: 1,
      className: 'IconButton',
      'data-command': 'GptVoiceAudioDebug.refresh',
      title: 'Refresh Recordings',
      type: VirtualDomElements.Button,
    },
    {
      childCount: 0,
      className: mergeClassNames('MaskIcon', 'MaskIconRefresh'),
      role: AriaRoles.None,
      type: VirtualDomElements.Div,
    },
    {
      ariaLabel: 'Open Audio Debug Settings',
      childCount: 1,
      className: 'IconButton',
      'data-command': 'GptVoiceAudioDebug.openSettings',
      title: 'Open Audio Debug Settings',
      type: VirtualDomElements.Button,
    },
    {
      childCount: 0,
      className: mergeClassNames('MaskIcon', 'MaskIconSettingsGear'),
      role: AriaRoles.None,
      type: VirtualDomElements.Div,
    },
  ])
})
