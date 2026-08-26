import { FundedVoiceError } from '../FundedVoice/FundedVoice.ts'

const connectionErrorCodes = new Set([
  'connection_closed',
  'connection_error',
  'err_network',
  'e_our_backend_closed_websocket',
  'network_error',
])

const connectionErrorMessages = [
  'connection error',
  'connection failed',
  'failed to fetch',
  'ice failed',
  'network error',
  'networkerror',
]

const getErrorCode = (error: unknown): string => {
  if (error instanceof FundedVoiceError) {
    return error.code.toLowerCase()
  }
  if (
    error &&
    typeof error === 'object' &&
    'code' in error &&
    typeof error.code === 'string'
  ) {
    return error.code.toLowerCase()
  }
  return ''
}

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message.toLowerCase()
  }
  return typeof error === 'string' ? error.toLowerCase() : ''
}

export const isOfflineConnectionError = (
  error: unknown,
  isOnline: boolean = globalThis.navigator?.onLine ?? true,
): boolean => {
  if (isOnline) {
    return false
  }
  const code = getErrorCode(error)
  if (connectionErrorCodes.has(code)) {
    return true
  }
  const message = getErrorMessage(error)
  return connectionErrorMessages.some((part) => message.includes(part))
}
