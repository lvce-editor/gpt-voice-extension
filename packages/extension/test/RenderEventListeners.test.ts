import { test, expect } from '@jest/globals'
import * as DomEventListenerFunctions from '../src/parts/DomEventListenerFunctions/DomEventListenerFunctions.ts'
import { renderEventListeners } from '../src/parts/RenderEventListeners/RenderEventListeners.ts'

test('renderEventListeners - returns all listeners', () => {
  const eventListeners = renderEventListeners()
  expect(eventListeners).toEqual([
    {
      name: DomEventListenerFunctions.HandleOpenAiApiKeyInput,
      params: ['handleOpenAiApiKeyInput', 'event.target.value'],
    },
    {
      name: DomEventListenerFunctions.HandleClearOpenAiApiKey,
      params: ['handleClearOpenAiApiKey'],
    },
    {
      name: DomEventListenerFunctions.HandleSaveOpenAiApiKey,
      params: ['handleSaveOpenAiApiKey'],
    },
    {
      name: DomEventListenerFunctions.HandleClickStart,
      params: ['handleClickStart'],
    },
    {
      name: DomEventListenerFunctions.SetRealtimeModelMini,
      params: ['setRealtimeModelMini'],
    },
    {
      name: DomEventListenerFunctions.SetRealtimeModelStandard,
      params: ['setRealtimeModelStandard'],
    },
    {
      name: DomEventListenerFunctions.ToggleToolCall,
      params: ['toggleToolCall', 'event.target.name'],
    },
  ])
})
