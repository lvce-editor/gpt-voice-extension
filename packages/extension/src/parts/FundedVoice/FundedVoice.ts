import type { BackendVoiceConfiguration } from '../BackendConfiguration/BackendConfiguration.ts'

export const fundedVoiceProtocol = 'lvce.realtime.voice.v1'

export interface FundedSessionCreatedEvent {
  readonly answerSdp: string
  readonly limitVirtualTokens: number
  readonly remainingVirtualTokens: number
  readonly type: 'lvce.session.created'
  readonly usedVirtualTokens: number
}

interface WebSocketFactory {
  // The DOM WebSocket constructor accepts a mutable protocol array.
  // eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types
  new (url: string | URL, protocols?: string | string[]): WebSocket
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)

export const getFundedVoiceUrl = (baseUrl: string): string => {
  const url = new URL(baseUrl)
  url.protocol = url.protocol === 'http:' ? 'ws:' : 'wss:'
  const path = url.pathname.endsWith('/')
    ? url.pathname.slice(0, -1)
    : url.pathname
  url.pathname = `${path}/v1/realtime/voice`
  url.search = ''
  url.hash = ''
  return url.href
}

export const openFundedVoiceSocket = async (
  configuration: Readonly<BackendVoiceConfiguration>,
  WebSocketConstructor: WebSocketFactory = WebSocket,
): Promise<WebSocket> => {
  const socket = new WebSocketConstructor(
    getFundedVoiceUrl(configuration.baseUrl),
    [fundedVoiceProtocol, configuration.accessToken],
  )
  await new Promise<void>((resolve, reject) => {
    socket.addEventListener('open', () => resolve(), { once: true })
    socket.addEventListener(
      'error',
      () => reject(new Error('Backend-funded voice is unavailable.')),
      { once: true },
    )
    socket.addEventListener(
      'close',
      () => reject(new Error('Backend-funded voice closed while connecting.')),
      { once: true },
    )
  })
  return socket
}

export const waitForFundedSessionCreated = async (
  socket: Readonly<WebSocket>,
  offerSdp: string,
  session: Readonly<Record<string, unknown>>,
): Promise<FundedSessionCreatedEvent> => {
  const { promise, reject, resolve } =
    Promise.withResolvers<FundedSessionCreatedEvent>()
  const handleMessage = (event: { readonly data: unknown }): void => {
    let parsed: unknown
    try {
      parsed = JSON.parse(String(event.data))
    } catch {
      reject(new Error('Backend-funded voice returned invalid JSON.'))
      return
    }
    if (!isRecord(parsed)) {
      return
    }
    if (parsed.type === 'error') {
      const error = isRecord(parsed.error) ? parsed.error : undefined
      reject(
        new Error(
          typeof error?.message === 'string'
            ? error.message
            : 'Backend-funded voice session failed.',
        ),
      )
      return
    }
    if (
      parsed.type === 'lvce.session.created' &&
      typeof parsed.answerSdp === 'string'
    ) {
      resolve(parsed as unknown as FundedSessionCreatedEvent)
    }
  }
  const handleClose = (): void => {
    reject(new Error('Backend-funded voice closed while creating a session.'))
  }
  socket.addEventListener('message', handleMessage)
  socket.addEventListener('close', handleClose, { once: true })
  socket.send(
    JSON.stringify({
      offerSdp,
      session,
      type: 'lvce.session.create',
    }),
  )
  try {
    return await promise
  } finally {
    socket.removeEventListener('message', handleMessage)
    socket.removeEventListener('close', handleClose)
  }
}
