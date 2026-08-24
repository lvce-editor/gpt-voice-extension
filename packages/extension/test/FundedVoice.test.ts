import { describe, expect, it } from '@jest/globals'
import {
  formatFundedVoiceError,
  fundedVoiceProtocol,
  getFundedVoiceError,
  getFundedVoiceUrl,
  openFundedVoiceSocket,
  waitForFundedSessionCreated,
} from '../src/parts/FundedVoice/FundedVoice.ts'

const normalizeProtocols = (
  protocols: string | readonly string[] | undefined,
): readonly string[] => {
  if (Array.isArray(protocols)) {
    return protocols
  }
  return protocols ? [protocols as string] : []
}

class FakeWebSocket extends EventTarget {
  static readonly OPEN = 1
  readonly sent: string[] = []
  readonly url: string
  readonly protocols: readonly string[]
  readyState = FakeWebSocket.OPEN

  constructor(url: string | URL, protocols?: string | readonly string[]) {
    super()
    this.url = String(url)
    this.protocols = normalizeProtocols(protocols)
    if (new.target === FakeWebSocket) {
      queueMicrotask(() => this.dispatchEvent(new Event('open')))
    }
  }

  close(): void {
    this.readyState = 3
    this.dispatchEvent(new Event('close'))
  }

  send(data: string): void {
    this.sent.push(data)
  }
}

class ErrorWebSocket extends FakeWebSocket {
  constructor(url: string | URL, protocols?: string | readonly string[]) {
    super(url, protocols)
    queueMicrotask(() => this.dispatchEvent(new Event('error')))
  }
}

class ClosedWebSocket extends FakeWebSocket {
  constructor(url: string | URL, protocols?: string | readonly string[]) {
    super(url, protocols)
    queueMicrotask(() => this.dispatchEvent(new Event('close')))
  }
}

describe('FundedVoice', () => {
  it('builds the authenticated backend websocket URL', () => {
    expect(getFundedVoiceUrl('https://lvce.example/backend/')).toBe(
      'wss://lvce.example/backend/v1/realtime/voice',
    )
    expect(getFundedVoiceUrl('http://localhost:3000')).toBe(
      'ws://localhost:3000/v1/realtime/voice',
    )
    expect(getFundedVoiceUrl('https://lvce.example/backend')).toBe(
      'wss://lvce.example/backend/v1/realtime/voice',
    )
  })

  it('opens with the LVCE protocol and access token', async () => {
    const socket = (await openFundedVoiceSocket(
      { accessToken: 'token-1', baseUrl: 'https://lvce.example' },
      FakeWebSocket as unknown as NonNullable<
        Parameters<typeof openFundedVoiceSocket>[1]
      >,
    )) as unknown as FakeWebSocket

    expect(socket.url).toBe('wss://lvce.example/v1/realtime/voice')
    expect(socket.protocols).toEqual([fundedVoiceProtocol, 'token-1'])
  })

  it('formats backend error codes and status codes alongside messages', () => {
    const error = getFundedVoiceError(
      {
        error: {
          code: 'invalid_access_token',
          message: 'The access token is invalid or expired',
          statusCode: 401,
        },
        status: 401,
        type: 'error',
      },
      'Backend-funded voice failed.',
      'unknown_server_error',
    )

    expect(formatFundedVoiceError(error)).toBe(
      'The access token is invalid or expired (Error code: invalid_access_token; HTTP status: 401)',
    )
  })

  it('reports backend connection errors and early closes', async () => {
    await expect(
      openFundedVoiceSocket(
        { accessToken: 'token', baseUrl: 'https://lvce.example' },
        ErrorWebSocket as unknown as NonNullable<
          Parameters<typeof openFundedVoiceSocket>[1]
        >,
      ),
    ).rejects.toThrow('Backend-funded voice is unavailable.')
    await expect(
      openFundedVoiceSocket(
        { accessToken: 'token', baseUrl: 'https://lvce.example' },
        ClosedWebSocket as unknown as NonNullable<
          Parameters<typeof openFundedVoiceSocket>[1]
        >,
      ),
    ).rejects.toThrow('Backend-funded voice closed while connecting.')
  })

  it('sends session creation and waits for answer SDP', async () => {
    const socket = new FakeWebSocket('ws://localhost')
    const created = waitForFundedSessionCreated(
      socket as unknown as WebSocket,
      'offer-sdp',
      { model: 'gpt-realtime-2.1-mini' },
    )
    socket.dispatchEvent(
      new MessageEvent('message', {
        data: JSON.stringify({
          answerSdp: 'answer-sdp',
          limitVirtualTokens: 100,
          remainingVirtualTokens: 90,
          type: 'lvce.session.created',
          usedVirtualTokens: 10,
        }),
      }),
    )

    await expect(created).resolves.toMatchObject({
      answerSdp: 'answer-sdp',
      type: 'lvce.session.created',
    })
    expect(JSON.parse(socket.sent[0] || '')).toEqual({
      offerSdp: 'offer-sdp',
      session: { model: 'gpt-realtime-2.1-mini' },
      type: 'lvce.session.create',
    })
  })

  it('ignores unrelated events before session creation completes', async () => {
    const socket = new FakeWebSocket('ws://localhost')
    const created = waitForFundedSessionCreated(
      socket as unknown as WebSocket,
      'offer',
      {},
    )
    socket.dispatchEvent(new MessageEvent('message', { data: 'null' }))
    socket.dispatchEvent(
      new MessageEvent('message', {
        data: JSON.stringify({ type: 'lvce.usage.updated' }),
      }),
    )
    socket.dispatchEvent(
      new MessageEvent('message', {
        data: JSON.stringify({ type: 'lvce.session.created' }),
      }),
    )
    socket.dispatchEvent(
      new MessageEvent('message', {
        data: JSON.stringify({
          answerSdp: 'answer',
          type: 'lvce.session.created',
        }),
      }),
    )

    await expect(created).resolves.toMatchObject({ answerSdp: 'answer' })
  })

  it('reports invalid JSON, backend errors, and early session closes', async () => {
    const invalidJsonSocket = new FakeWebSocket('ws://localhost')
    const invalidJson = waitForFundedSessionCreated(
      invalidJsonSocket as unknown as WebSocket,
      'offer',
      {},
    )
    invalidJsonSocket.dispatchEvent(new MessageEvent('message', { data: '{' }))
    await expect(invalidJson).rejects.toThrow(
      'Backend-funded voice returned invalid JSON.',
    )

    const errorSocket = new FakeWebSocket('ws://localhost')
    const backendError = waitForFundedSessionCreated(
      errorSocket as unknown as WebSocket,
      'offer',
      {},
    )
    errorSocket.dispatchEvent(
      new MessageEvent('message', {
        data: JSON.stringify({
          error: {
            code: 'E_LVCE_USAGE_EXCEEDED',
            message: 'allowance unavailable',
            statusCode: 402,
          },
          type: 'error',
        }),
      }),
    )
    await expect(backendError).rejects.toMatchObject({
      code: 'E_LVCE_USAGE_EXCEEDED',
      message: 'allowance unavailable',
      statusCode: 402,
    })

    const genericErrorSocket = new FakeWebSocket('ws://localhost')
    const genericError = waitForFundedSessionCreated(
      genericErrorSocket as unknown as WebSocket,
      'offer',
      {},
    )
    genericErrorSocket.dispatchEvent(
      new MessageEvent('message', {
        data: JSON.stringify({ type: 'error' }),
      }),
    )
    await expect(genericError).rejects.toThrow(
      'Backend-funded voice session failed.',
    )

    const closedSocket = new FakeWebSocket('ws://localhost')
    const closed = waitForFundedSessionCreated(
      closedSocket as unknown as WebSocket,
      'offer',
      {},
    )
    closedSocket.close()
    await expect(closed).rejects.toThrow(
      'Backend-funded voice closed while creating a session.',
    )
  })
})
