import { expect, test } from '@jest/globals'
import { FundedVoiceError } from '../src/parts/FundedVoice/FundedVoice.ts'
import { isOfflineConnectionError } from '../src/parts/OfflineError/OfflineError.ts'

test('detects funded connection errors while offline', () => {
  expect(
    isOfflineConnectionError(
      new FundedVoiceError('Voice unavailable', 'connection_error'),
      false,
    ),
  ).toBe(true)
  expect(
    isOfflineConnectionError(
      new FundedVoiceError(
        'The backend closed the connection',
        'E_OUR_BACKEND_CLOSED_WEBSOCKET',
      ),
      false,
    ),
  ).toBe(true)
})

test('detects fetch and WebRTC connection failures while offline', () => {
  expect(isOfflineConnectionError(new Error('Failed to fetch'), false)).toBe(
    true,
  )
  expect(isOfflineConnectionError(new Error('ICE failed'), false)).toBe(true)
  expect(isOfflineConnectionError({ code: 'ERR_NETWORK' }, false)).toBe(true)
})

test('does not replace specific or online errors', () => {
  expect(
    isOfflineConnectionError(
      new FundedVoiceError('Invalid token', 'invalid_access_token'),
      false,
    ),
  ).toBe(false)
  expect(isOfflineConnectionError(new Error('Failed to fetch'), true)).toBe(
    false,
  )
  expect(isOfflineConnectionError(undefined, false)).toBe(false)
})
