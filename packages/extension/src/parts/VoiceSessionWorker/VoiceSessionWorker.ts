import type { AudioDebugStorage } from 'voice-shared'
import {
  createRpc,
  deleteSecret,
  getPreference,
  getSecret,
  setRemoteDescription,
  startWebRtcAudioStream,
  stopWebRtcAudioStream,
  storeSecret,
  writeFile,
} from '@lvce-editor/api'
import type { IState } from '../CreateInstance/CreateInstance.ts'
import { audioDebugPreference } from '../AudioDebugConstants/AudioDebugConstants.ts'
import { resolveBackendVoiceConfiguration } from '../BackendConfiguration/BackendConfiguration.ts'
import * as ClassNames from '../ClassNames/ClassNames.ts'
import { getMicrophoneAudioConstraints } from '../MicrophoneAudioConstraints/MicrophoneAudioConstraints.ts'
import * as VoiceFunctionCallingWorker from '../VoiceFunctionCallingWorker/VoiceFunctionCallingWorker.ts'

interface Rpc {
  readonly dispose: () => void | Promise<void>
  readonly invoke: (
    method: string,
    ...params: readonly unknown[]
  ) => Promise<unknown>
}

type CreateRpc = typeof createRpc
type StateListener = (
  state: Readonly<IState>,
  transcriptScroll: boolean,
) => void

interface Transport {
  readonly audioDebugMessagePort: MessagePort | undefined
  readonly dataChannelPort: MessagePort
}

export const state: {
  createRpc: CreateRpc
  nextSessionId: number
  refreshAudioDebugViews: () => Promise<void>
  rpcPromise: Promise<Rpc> | undefined
} = {
  createRpc,
  nextSessionId: 1,
  refreshAudioDebugViews: async (): Promise<void> => {},
  rpcPromise: undefined,
}

const listeners = new Map<number, StateListener>()
const transports = new Map<number, Transport>()

export const setRefreshAudioDebugViews = (
  refresh: () => Promise<void>,
): void => {
  state.refreshAudioDebugViews = refresh
}

const closeTransport = (sessionId: number): void => {
  const transport = transports.get(sessionId)
  if (!transport) {
    return
  }
  transport.dataChannelPort.close()
  transport.audioDebugMessagePort?.close()
  transports.delete(sessionId)
}

const commandMap = {
  'VoiceHost.deleteSecret': deleteSecret,
  'VoiceHost.executeFunctionToolCall':
    VoiceFunctionCallingWorker.executeFunctionToolCall,
  'VoiceHost.getRegisteredTools': VoiceFunctionCallingWorker.getRegisteredTools,
  'VoiceHost.getSecret': getSecret,
  'VoiceHost.resolveBackendConfiguration': resolveBackendVoiceConfiguration,
  async 'VoiceHost.sendWebRtcMessage'(
    sessionId: number,
    data: string,
  ): Promise<void> {
    const transport = transports.get(sessionId)
    if (!transport) {
      throw new Error('Voice WebRTC data channel is not connected')
    }
    transport.dataChannelPort.postMessage(data)
  },
  async 'VoiceHost.setRemoteDescription'(
    uid: number,
    sdp: string,
  ): Promise<void> {
    await setRemoteDescription({ sdp, type: 'answer', uid })
  },
  async 'VoiceHost.startWebRtc'(
    sessionId: number,
    uid: number,
    ephemeralKey: string,
  ): Promise<string> {
    closeTransport(sessionId)
    const rpc = await getRpc()
    const dataChannel = new MessageChannel()
    // MessageEvent is a mutable DOM type, but the adapter only reads it.
    // eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types
    dataChannel.port2.onmessage = (event: MessageEvent): void => {
      const data =
        typeof event.data === 'string' ? event.data : JSON.stringify(event.data)
      void rpc
        .invoke('VoiceSession.dispatch', sessionId, 'data', data)
        .catch(console.error)
    }
    dataChannel.port2.start()

    let audioDebugPort: MessagePort | undefined
    let audioDebugMessagePort: MessagePort | undefined
    if ((await getPreference(audioDebugPreference)) === true) {
      const audioDebugChannel = new MessageChannel()
      audioDebugPort = audioDebugChannel.port1
      audioDebugMessagePort = audioDebugChannel.port2
      // MessageEvent is a mutable DOM type, but the adapter only reads it.
      // eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types
      audioDebugMessagePort.onmessage = (event: MessageEvent): void => {
        if (!(event.data instanceof Blob)) {
          return
        }
        const { refreshAudioDebugViews } = state
        void rpc
          .invoke('AudioDebug.save', event.data)
          .then(refreshAudioDebugViews)
          .catch(console.error)
      }
      audioDebugMessagePort.start()
    }
    transports.set(sessionId, {
      audioDebugMessagePort,
      dataChannelPort: dataChannel.port2,
    })
    try {
      const audioConstraints = await getMicrophoneAudioConstraints()
      return await startWebRtcAudioStream({
        audioConstraints,
        ...(audioDebugPort && { audioDebugPort }),
        elementLocator: `.${ClassNames.GptVoiceAudio}`,
        ephemeralKey,
        port: dataChannel.port1,
        trackAudioData: true,
        uid,
      })
    } catch (error) {
      closeTransport(sessionId)
      throw error
    }
  },
  async 'VoiceHost.stopWebRtc'(sessionId: number, uid: number): Promise<void> {
    try {
      await stopWebRtcAudioStream(uid)
    } finally {
      closeTransport(sessionId)
    }
  },
  'VoiceHost.storeSecret': storeSecret,
  'VoiceHost.updateState'(
    sessionId: number,
    voiceState: IState,
    transcriptScroll: boolean,
  ): void {
    listeners.get(sessionId)?.(voiceState, transcriptScroll)
  },
  'VoiceHost.writeFile': writeFile,
}

const getRpc = (): Promise<Rpc> => {
  const { createRpc, rpcPromise } = state
  if (rpcPromise) {
    return rpcPromise
  }
  const newRpcPromise = createRpc({
    commandMap,
    id: 'builtin.gpt-voice.voice-session-worker',
  })
  state.rpcPromise = newRpcPromise
  return newRpcPromise
}

export interface VoiceSession {
  readonly dispatch: (
    action: string,
    ...params: readonly unknown[]
  ) => Promise<IState>
  readonly dispose: () => Promise<void>
}

export const create = async (
  isTest: boolean,
  testVoiceProvider: 'byok' | 'funded',
  listener: StateListener,
): Promise<Readonly<{ session: VoiceSession; voiceState: IState }>> => {
  const { nextSessionId: sessionId } = state
  state.nextSessionId++
  listeners.set(sessionId, listener)
  const rpc = await getRpc()
  try {
    const voiceState = (await rpc.invoke(
      'VoiceSession.create',
      sessionId,
      isTest,
      testVoiceProvider,
    )) as IState
    return {
      session: {
        async dispatch(action, ...params): Promise<IState> {
          return rpc.invoke(
            'VoiceSession.dispatch',
            sessionId,
            action,
            ...params,
          ) as Promise<IState>
        },
        async dispose(): Promise<void> {
          try {
            await rpc.invoke('VoiceSession.dispose', sessionId)
          } finally {
            closeTransport(sessionId)
            listeners.delete(sessionId)
          }
        },
      },
      voiceState,
    }
  } catch (error) {
    listeners.delete(sessionId)
    throw error
  }
}

export const audioDebugStorage: AudioDebugStorage = {
  async clearAll() {
    const rpc = await getRpc()
    return rpc.invoke('AudioDebug.clearAll') as ReturnType<
      AudioDebugStorage['clearAll']
    >
  },
  async list() {
    const rpc = await getRpc()
    return rpc.invoke('AudioDebug.list') as ReturnType<
      AudioDebugStorage['list']
    >
  },
  async read(uri) {
    const rpc = await getRpc()
    return rpc.invoke('AudioDebug.read', uri) as ReturnType<
      AudioDebugStorage['read']
    >
  },
  async remove(uri) {
    const rpc = await getRpc()
    return rpc.invoke('AudioDebug.remove', uri) as ReturnType<
      AudioDebugStorage['remove']
    >
  },
  async save(blob) {
    const rpc = await getRpc()
    return rpc.invoke('AudioDebug.save', blob) as ReturnType<
      AudioDebugStorage['save']
    >
  },
}
