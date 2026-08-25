import type { VirtualDomNode } from '@lvce-editor/virtual-dom-worker'
import {
  getPreference,
  openUri,
  type View,
  type ViewContext,
  type ViewEvent,
  type VirtualDomViewInstance,
} from '@lvce-editor/api'
import type { AudioDebugStorage } from '../AudioDebugStorage/AudioDebugStorage.ts'
import {
  audioDebugPreference,
  audioDebugScheme,
  audioDebugViewId,
} from '../AudioDebugConstants/AudioDebugConstants.ts'
import {
  renderAudioDebugView,
  type AudioDebugViewState,
} from '../RenderAudioDebugView/RenderAudioDebugView.ts'
import { audioDebugStorage } from '../VoiceSessionWorker/VoiceSessionWorker.ts'

interface AudioDebugViewDependencies {
  readonly getPreference: typeof getPreference
  readonly openUri: typeof openUri
  readonly storage: AudioDebugStorage
}

const defaultDependencies: AudioDebugViewDependencies = {
  getPreference,
  openUri,
  storage: audioDebugStorage,
}

export interface ActiveAudioDebugViewInstance extends VirtualDomViewInstance {
  readonly handleClick: (uri: string) => Promise<void>
  readonly refresh: () => Promise<void>
}

const activeInstances = new Set<ActiveAudioDebugViewInstance>()

export const refreshActiveAudioDebugViewInstances = async (): Promise<void> => {
  await Promise.all(
    Array.from(activeInstances, (instance) => instance.refresh()),
  )
}

export const createAudioDebugViewInstance = async (
  context?: ViewContext,
  dependencies: Readonly<AudioDebugViewDependencies> = defaultDependencies,
): Promise<ActiveAudioDebugViewInstance> => {
  let state: AudioDebugViewState = {
    enabled: false,
    error: '',
    recordings: [],
  }

  const refresh = async (): Promise<void> => {
    const enabled =
      (await dependencies.getPreference(audioDebugPreference)) === true
    try {
      state = {
        enabled,
        error: '',
        recordings: enabled ? await dependencies.storage.list() : [],
      }
    } catch (error) {
      state = {
        enabled,
        error: error instanceof Error ? error.message : String(error),
        recordings: [],
      }
    }
    await context?.requestRerender()
  }

  const instance: ActiveAudioDebugViewInstance = {
    dispose(): void {
      activeInstances.delete(instance)
    },
    async handleClick(uri: string): Promise<void> {
      if (uri.startsWith(`${audioDebugScheme}:///`)) {
        await dependencies.openUri(uri)
      }
    },
    async handleEvent(event: Readonly<ViewEvent>): Promise<void> {
      if (event.type === 'click' && event.name) {
        await instance.handleClick(event.name)
      }
    },
    async refresh(): Promise<void> {
      await refresh()
    },
    render(): readonly VirtualDomNode[] {
      return renderAudioDebugView(state)
    },
  }
  activeInstances.add(instance)
  await refresh()
  return instance
}

export const audioDebugView: View<ActiveAudioDebugViewInstance> = {
  create: createAudioDebugViewInstance,
  displayName: 'Voice Audio Recordings',
  eventListeners: [
    {
      name: 'handleClick',
      params: ['handleClick', 'event.currentTarget.name'],
    },
  ],
  icon: 'sound',
  id: audioDebugViewId,
  kind: 'virtualDom',
  title: 'Voice Audio Recordings',
}
