import type {
  ViewContext,
  ViewSelection,
  VirtualDomViewInstance,
} from '@lvce-editor/api'
import type { VirtualDomNode } from '@lvce-editor/virtual-dom-worker'
import type {
  CaptureFixtureOptions as SharedCaptureFixtureOptions,
  ToolCallMessage as SharedToolCallMessage,
  TranscriptMessage as SharedTranscriptMessage,
  VoiceMessage as SharedVoiceMessage,
  VoiceSessionState as SharedVoiceSessionState,
  VoiceWorkToolCallEvent,
} from 'voice-shared'
import { readMicLevels } from '@lvce-editor/api'
import type { MenuEntry } from '../MenuEntries/MenuEntries.ts'
import { animateBubble } from '../AnimateBubble/AnimateBubble.ts'
import * as ClassNames from '../ClassNames/ClassNames.ts'
import { getCss } from '../GetCss/GetCss.ts'
import { getTitle } from '../GetTitle/GetTitle.ts'
import { readLevel } from '../ReadLevel/ReadLevel.ts'
import { RealtimeModelPreset } from '../RealtimeModelPreset/RealtimeModelPreset.ts'
import { render } from '../Render/Render.ts'
import { renderActionsDom } from '../RenderActionsDom/RenderActionsDom.ts'
import { getTestVoiceProvider, isInTestMode } from '../TestMode/TestMode.ts'
import * as VoiceSessionWorker from '../VoiceSessionWorker/VoiceSessionWorker.ts'

const focusSelector = `.${ClassNames.Main}`
const transcriptSelector = `.${ClassNames.GptVoiceTranscript}`
const maxScrollTop = 9_999_999

export type CaptureFixtureOptions = SharedCaptureFixtureOptions
export type ITranscript = SharedTranscriptMessage
export type IToolCallMessage = SharedToolCallMessage
export type IMessage = SharedVoiceMessage
export type IState = SharedVoiceSessionState

export interface ActiveGptVoiceViewInstance extends VirtualDomViewInstance {
  readonly addTranscript: (
    id: string,
    value: string,
    type: 'user' | 'ai',
  ) => Promise<void>
  readonly captureFixture: (options: CaptureFixtureOptions) => Promise<void>
  readonly doAnimate: () => Promise<void>
  readonly getComponentState: () => Promise<IState>
  readonly getContext: () => Readonly<Record<string, boolean>>
  readonly getCss: () => string
  readonly getMenuEntries: (menuId: string) => readonly MenuEntry[]
  readonly handleClearChat: () => Promise<void>
  readonly handleClearOpenAiApiKey: () => Promise<void>
  readonly handleClickStart: () => Promise<void>
  readonly handleData: (data: string) => Promise<void>
  readonly handleOpenAiApiKeyInput: (value: string) => Promise<void>
  readonly handleSaveOpenAiApiKey: () => Promise<void>
  readonly handleUseOwnApiKey: () => Promise<void>
  readonly renderActionsDom: () => readonly VirtualDomNode[]
  readonly renderScrollPosition: () =>
    | readonly []
    | readonly [selector: string, scrollTop: number]
  readonly renderTitle: () => string
  readonly replayFixture: (fixture: unknown) => Promise<void>
  readonly reportWorkToolCall: (
    parentCallId: string,
    event: VoiceWorkToolCallEvent,
  ) => Promise<void>
  readonly setAnimation: (enabled: boolean, scale: number) => void
  readonly setComponentState: (state: IState) => Promise<void>
  readonly setFundedError: (error: unknown) => Promise<void>
  readonly setOfflineError: (error: unknown) => Promise<void>
  readonly setRealtimeModelMini: () => Promise<void>
  readonly setRealtimeModelStandard: () => Promise<void>
  readonly stop: () => Promise<void>
  readonly toggleToolCall: (callId: string) => Promise<void>
}

export const createInstance = async (
  context?: ViewContext,
): Promise<ActiveGptVoiceViewInstance> => {
  let state: IState
  let transcriptScrollPending = false
  let animationLoopRunning = false
  let disposed = false

  const applyState = (nextState: IState, transcriptScroll: boolean): void => {
    if (disposed) {
      return
    }
    state = nextState
    transcriptScrollPending ||= transcriptScroll
    void context?.requestRerender()
    const { animationEnabled } = state
    if (animationEnabled && !animationLoopRunning) {
      void instance.doAnimate()
    }
  }

  const { session, voiceState } = await VoiceSessionWorker.create(
    isInTestMode(),
    getTestVoiceProvider(),
    applyState,
  )
  state = voiceState

  const dispatch = async (
    action: string,
    ...params: readonly unknown[]
  ): Promise<void> => {
    applyState(await session.dispatch(action, ...params), false)
  }

  const instance: ActiveGptVoiceViewInstance = {
    async addTranscript(id, value, type): Promise<void> {
      await dispatch('addTranscript', id, value, type)
    },
    async captureFixture(options): Promise<void> {
      await dispatch('captureFixture', options)
    },
    async dispose(): Promise<void> {
      disposed = true
      await session.dispose()
    },
    async doAnimate(): Promise<void> {
      if (animationLoopRunning) {
        return
      }
      animationLoopRunning = true
      try {
        while (true) {
          const { animationEnabled, uid } = state
          if (!animationEnabled || disposed) {
            break
          }
          try {
            const data = await readMicLevels({ uid })
            await new Promise((resolve) => requestAnimationFrame(resolve))
            const { animationEnabled: isAnimationStillEnabled } = state
            if (!isAnimationStillEnabled || disposed) {
              break
            }
            const animation = animateBubble(
              readLevel(data.micAnalyzerData),
              readLevel(data.remoteAnalyzerData),
            )
            instance.setAnimation(true, animation.scale)
          } catch (error) {
            console.error(error)
          }
        }
      } finally {
        animationLoopRunning = false
      }
    },
    async getComponentState(): Promise<IState> {
      const sessionState = await session.getComponentState()
      const { animationEnabled, animationScale } = state
      return { ...sessionState, animationEnabled, animationScale }
    },
    getContext() {
      return {}
    },
    getCss() {
      return getCss(state)
    },
    getMenuEntries() {
      return []
    },
    async handleClearChat(): Promise<void> {
      await dispatch('clearChat')
    },
    async handleClearOpenAiApiKey(): Promise<void> {
      await dispatch('clearApiKey')
    },
    async handleClickStart(): Promise<void> {
      await dispatch('start')
    },
    async handleData(data): Promise<void> {
      await dispatch('data', data)
    },
    async handleOpenAiApiKeyInput(value): Promise<void> {
      await dispatch('inputApiKey', value)
    },
    async handleSaveOpenAiApiKey(): Promise<void> {
      await dispatch('saveApiKey')
    },
    async handleUseOwnApiKey(): Promise<void> {
      await dispatch('useOwnApiKey')
    },
    render() {
      return render(state)
    },
    renderActionsDom() {
      return renderActionsDom()
    },
    renderFocus(): string {
      return focusSelector
    },
    renderScrollPosition() {
      if (!transcriptScrollPending) {
        return []
      }
      transcriptScrollPending = false
      return [transcriptSelector, maxScrollTop]
    },
    renderSelections(): readonly ViewSelection[] {
      return []
    },
    renderTitle() {
      return getTitle(state)
    },
    async replayFixture(fixture): Promise<void> {
      await dispatch('replayFixture', fixture)
    },
    async reportWorkToolCall(parentCallId, event): Promise<void> {
      await dispatch('reportWorkToolCall', parentCallId, event)
    },
    saveState(): unknown {
      return {}
    },
    setAnimation(enabled, scale): void {
      state = { ...state, animationEnabled: enabled, animationScale: scale }
      void context?.requestRerender()
    },
    async setComponentState(newState: IState): Promise<void> {
      applyState(await session.setComponentState(newState), false)
    },
    async setFundedError(error): Promise<void> {
      await dispatch('setFundedError', error)
    },
    async setOfflineError(error): Promise<void> {
      await dispatch('setOfflineError', error)
    },
    async setRealtimeModelMini(): Promise<void> {
      await dispatch('setModel', RealtimeModelPreset.Mini)
    },
    async setRealtimeModelStandard(): Promise<void> {
      await dispatch('setModel', RealtimeModelPreset.Standard)
    },
    async stop(): Promise<void> {
      await dispatch('stop')
    },
    async toggleToolCall(callId): Promise<void> {
      await dispatch('toggleToolCall', callId)
    },
  }

  return instance
}
