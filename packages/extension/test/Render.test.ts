import { test, expect } from '@jest/globals'
import { text, VirtualDomElements } from '@lvce-editor/virtual-dom-worker'
import type { ITranscript } from '../src/parts/CreateInstance/CreateInstance.ts'
import * as DomEventListenerFunctions from '../src/parts/DomEventListenerFunctions/DomEventListenerFunctions.ts'
import { mergeClassNames } from '../src/parts/MergeClassNames/MergeClassNames.ts'
import { render } from '../src/parts/Render/Render.ts'
import { createRenderState } from '../src/parts/RenderTestHelpers.ts'
import { RealtimeModelPreset } from '../src/parts/WebRtc/WebRtc.ts'

test('render - returns virtual dom tree for idle mini state', () => {
  const state = createRenderState()
  const result = render(state)

  expect(result).toEqual([
    {
      childCount: 6,
      className: 'GptVoice',
      type: VirtualDomElements.Div,
    },
    {
      childCount: 2,
      className: 'GptVoiceToolbar',
      type: VirtualDomElements.Div,
    },
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
    {
      childCount: 1,
      className: 'GptVoiceApiKeyActions',
      type: VirtualDomElements.Div,
    },
    {
      childCount: 1,
      className: 'GptVoiceApiKeyClearButton',
      disabled: false,
      onClick: DomEventListenerFunctions.HandleClearOpenAiApiKey,
      type: VirtualDomElements.Button,
    },
    text('Change API key'),
    {
      childCount: 1,
      className: 'GptVoiceStage',
      type: VirtualDomElements.Div,
    },
    {
      childCount: 0,
      className: 'GptVoiceBubble',
      type: VirtualDomElements.Div,
    },
    {
      childCount: 1,
      className: 'GptVoiceStatus',
      type: VirtualDomElements.Div,
    },
    text('idle'),
    {
      childCount: 1,
      className: 'GptVoiceButton',
      id: 'toggle',
      onClick: DomEventListenerFunctions.HandleClickStart,
      type: VirtualDomElements.Button,
    },
    text('Start talking'),
    {
      childCount: 0,
      className: 'GptVoiceTranscript',
      type: VirtualDomElements.Div,
    },
    {
      childCount: 0,
      className: 'GptVoiceAudio',
      type: VirtualDomElements.Audio,
    },
  ])
})

test('render - returns welcome form when API key is missing', () => {
  const state = createRenderState({ hasOpenAiApiKey: false })
  const result = render(state)

  expect(result).toEqual([
    {
      childCount: 1,
      className: mergeClassNames('GptVoice', 'GptVoiceSetup'),
      type: VirtualDomElements.Div,
    },
    {
      childCount: 6,
      className: 'GptVoiceWelcome',
      type: VirtualDomElements.Div,
    },
    {
      childCount: 1,
      className: 'GptVoiceWelcomeTitle',
      type: VirtualDomElements.Div,
    },
    text('Set up your OpenAI API key'),
    {
      childCount: 0,
      className: 'GptVoiceWelcomeDescription',
      type: VirtualDomElements.Div,
    },
    text(
      'Your key is stored in extension secret storage. Press Save to continue.',
    ),
    {
      childCount: 0,
      className: 'GptVoiceApiKeyInput',
      disabled: false,
      inputType: 'password',
      name: 'openAiApiKey',
      onInput: DomEventListenerFunctions.HandleOpenAiApiKeyInput,
      placeholder: 'sk-...',
      type: VirtualDomElements.Input,
      value: '',
    },
    {
      childCount: 1,
      className: 'GptVoiceButton',
      disabled: false,
      onClick: DomEventListenerFunctions.HandleSaveOpenAiApiKey,
      type: VirtualDomElements.Button,
    },
    text('Save API key'),
    {
      childCount: 0,
      className: 'GptVoiceStatus',
      type: VirtualDomElements.Div,
    },
    text('OpenAI API key required to start a live voice session.'),
  ])
})

test('render - shows api key error in welcome form', () => {
  const result = render(
    createRenderState({
      apiKeyError: 'Invalid key',
      hasOpenAiApiKey: false,
      tokenError: 'Token error',
    }),
  )

  expect(result).toContainEqual(text('Invalid key'))
})

test('render - shows saving state in welcome form', () => {
  const result = render(
    createRenderState({
      hasOpenAiApiKey: false,
      isSavingApiKey: true,
    }),
  )

  expect(result).toContainEqual(text('Saving...'))
})

test('render - lets an exhausted funded user explicitly choose personal billing', () => {
  const result = render(
    createRenderState({
      allowanceExceeded: true,
      fundedAvailable: true,
      fundedError: 'Monthly allowance exceeded',
      hasOpenAiApiKey: false,
      voiceProvider: 'funded',
    }),
  )

  expect(result).toContainEqual(
    text('Your monthly AI allowance has been used.'),
  )
  expect(result).toContainEqual(text('Monthly allowance exceeded'))
  expect(result).toContainEqual(text('Use your own API key'))
})

test('render - allows funded voice to start without a personal API key', () => {
  const result = render(
    createRenderState({
      fundedAvailable: true,
      hasOpenAiApiKey: false,
      voiceProvider: 'funded',
    }),
  )

  expect(result).toContainEqual(text('Start talking'))
  expect(result).not.toContainEqual(text('Change API key'))
})

test('render - distinguishes a funded backend failure from allowance exhaustion', () => {
  const result = render(
    createRenderState({
      fundedError: 'Connection unavailable',
      hasOpenAiApiKey: false,
      voiceProvider: 'funded',
    }),
  )

  expect(result).toContainEqual(text('Backend-funded voice is unavailable.'))
  expect(result).toContainEqual(text('Connection unavailable'))
})

test('render - returns in-progress standard state for active conversation', () => {
  const transcript: ITranscript = {
    id: 'id-1',
    text: 'Hello',
    type: 'user',
  }
  const state = createRenderState({
    inProgress: true,
    messages: [transcript],
    sessionModel: RealtimeModelPreset.Standard,
  })
  const result = render(state)

  expect(result).toEqual([
    {
      childCount: 6,
      className: 'GptVoice',
      type: VirtualDomElements.Div,
    },
    {
      childCount: 2,
      className: 'GptVoiceToolbar',
      type: VirtualDomElements.Div,
    },
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
    {
      childCount: 1,
      className: 'GptVoiceApiKeyActions',
      type: VirtualDomElements.Div,
    },
    {
      childCount: 1,
      className: 'GptVoiceApiKeyClearButton',
      disabled: true,
      onClick: DomEventListenerFunctions.HandleClearOpenAiApiKey,
      type: VirtualDomElements.Button,
    },
    text('Change API key'),
    {
      childCount: 1,
      className: 'GptVoiceStage',
      type: VirtualDomElements.Div,
    },
    {
      childCount: 0,
      className: mergeClassNames('GptVoiceBubble', 'listening'),
      type: VirtualDomElements.Div,
    },
    {
      childCount: 1,
      className: 'GptVoiceStatus',
      type: VirtualDomElements.Div,
    },
    text('In Progress'),
    {
      childCount: 1,
      className: 'GptVoiceButton',
      id: 'toggle',
      onClick: DomEventListenerFunctions.HandleClickStart,
      type: VirtualDomElements.Button,
    },
    text('Stop talking'),
    {
      childCount: 1,
      className: 'GptVoiceTranscript',
      type: VirtualDomElements.Div,
    },
    {
      childCount: 1,
      className: mergeClassNames(
        'GptVoiceTranscriptItem',
        'GptVoiceTranscriptItemUser',
      ),
      type: VirtualDomElements.Div,
    },
    text('Hello'),
    {
      childCount: 0,
      className: 'GptVoiceAudio',
      type: VirtualDomElements.Audio,
    },
  ])
})
