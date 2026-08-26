import type { BackendVoiceConfiguration } from 'voice-shared'

export const fundedVoiceProtocol = 'lvce.realtime.voice.v1'
export const ourBackendClosedWebSocketErrorCode =
  'E_OUR_BACKEND_CLOSED_WEBSOCKET'

export interface FundedSessionCreatedEvent {
  readonly answerSdp: string
  readonly limitVirtualTokens: number
  readonly remainingVirtualTokens: number
  readonly type: 'lvce.session.created'
  readonly usedVirtualTokens: number
}

export class FundedVoiceError extends Error {
  readonly code: string
  readonly statusCode: number | undefined

  constructor(message: string, code: string, statusCode?: number) {
    super(message)
    this.name = 'FundedVoiceError'
    this.code = code
    this.statusCode = statusCode
  }
}

interface WebSocketFactory {
  // The DOM WebSocket constructor accepts a mutable protocol array.
  // eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types
  new (url: string | URL, protocols?: string | string[]): WebSocket
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)

const getStatusCode = (
  event: Readonly<Record<string, unknown>>,
  error: Readonly<Record<string, unknown>>,
): number | undefined => {
  for (const value of [
    error.statusCode,
    error.status,
    event.statusCode,
    event.status,
  ]) {
    if (typeof value === 'number' && Number.isSafeInteger(value)) {
      return value
    }
  }
  return undefined
}

export const getFundedVoiceError = (
  event: unknown,
  fallbackMessage: string,
  fallbackCode: string,
): FundedVoiceError => {
  const value = isRecord(event) ? event : {}
  const error = isRecord(value.error) ? value.error : {}
  const message =
    (typeof error.message === 'string' && error.message) ||
    (typeof value.message === 'string' && value.message) ||
    fallbackMessage
  const code =
    (typeof error.code === 'string' && error.code) ||
    (typeof value.code === 'string' && value.code) ||
    fallbackCode
  return new FundedVoiceError(message, code, getStatusCode(value, error))
}

const getFundedVoiceErrorMessage = (
  error: Readonly<FundedVoiceError>,
): string => {
  if (error.code === 'lvce_access_token_invalid') {
    return 'Your LVCE sign-in session is no longer valid. Sign out and sign in again.'
  }
  if (error.code === 'server_openai_authentication_failed') {
    return 'You are signed in to LVCE, but the voice backend could not authenticate with OpenAI. This is a server configuration problem; please try again later.'
  }
  if (error.code === 'invalid_access_token') {
    return 'Authentication failed, but the server did not identify whether your LVCE session or its OpenAI credential was rejected. Please try signing in again; if the error remains, the voice backend needs attention.'
  }
  return error.message
}

export const formatFundedVoiceError = (
  error: Readonly<FundedVoiceError>,
): string => {
  const message = getFundedVoiceErrorMessage(error)
  const status = error.statusCode ? `; HTTP status: ${error.statusCode}` : ''
  return `${message} (Error code: ${error.code}${status})`
}

export const getFundedVoiceCloseError = (
  event: Readonly<Pick<CloseEvent, 'code' | 'reason'>>,
): FundedVoiceError => {
  const closeCode =
    typeof event.code === 'number' && event.code > 0
      ? ` WebSocket close code: ${event.code}`
      : ''
  const closeReason = event.reason ? `; reason: ${event.reason}` : ''
  const closeDetails = closeCode ? `${closeCode}${closeReason}.` : ''
  return new FundedVoiceError(
    `The LVCE voice backend closed its WebSocket connection to the editor unexpectedly.${closeDetails}`,
    ourBackendClosedWebSocketErrorCode,
  )
}

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
      () =>
        reject(
          new FundedVoiceError(
            'Backend-funded voice is unavailable.',
            'connection_error',
          ),
        ),
      { once: true },
    )
    socket.addEventListener(
      'close',
      (event) => reject(getFundedVoiceCloseError(event)),
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
      reject(
        new FundedVoiceError(
          'Backend-funded voice returned invalid JSON.',
          'invalid_server_response',
        ),
      )
      return
    }
    if (!isRecord(parsed)) {
      return
    }
    if (parsed.type === 'error') {
      reject(
        getFundedVoiceError(
          parsed,
          'Backend-funded voice session failed.',
          'unknown_server_error',
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
    reject(
      new FundedVoiceError(
        'Backend-funded voice closed while creating a session.',
        'connection_closed',
      ),
    )
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
