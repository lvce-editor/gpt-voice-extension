import * as DomEventListenerFunctions from '../DomEventListenerFunctions/DomEventListenerFunctions.ts'

interface DomEventListener {
  readonly name: string | number
  readonly params: readonly string[]
  readonly preventDefault?: boolean
  readonly trackPointerEvents?: readonly (string | number)[]
}

export const renderEventListeners = (): readonly DomEventListener[] => {
  return [
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
  ]
}
