import { i18nString } from '@lvce-editor/i18n'

export const failedToClearOpenAiApiKey = (): string =>
  i18nString('Failed to clear OpenAI API key.')

export const failedToCreateToken = (): string =>
  i18nString('Failed to create token.')

export const failedToCreateTokenWithDetails = (): string =>
  i18nString('Failed to create token. Check your network and API key.')

export const failedToSaveOpenAiApiKey = (): string =>
  i18nString('Failed to save OpenAI API key.')

export const fundedVoiceClosed = (): string =>
  i18nString(
    'The backend-funded voice connection closed. Start again to reconnect.',
  )

export const fundedVoiceUnavailable = (): string =>
  i18nString('Backend-funded voice is unavailable.')

export const invalidOpenAiApiKey = (): string =>
  i18nString('OpenAI API key is invalid (401/403).')

export const invalidOpenAiApiKeyFormat = (): string =>
  i18nString('OpenAI API key format looks invalid.')

export const missingOpenAiApiKey = (): string =>
  i18nString('NO_API_KEY: OpenAI API key is not set.')

export const missingOpenAiApiKeyPrompt = (): string =>
  i18nString('NO_API_KEY: Add your OpenAI API key above to start.')

export const monthlyAllowanceExceeded = (): string =>
  i18nString('Your monthly AI allowance has been used.')

export const networkFailure = (): string =>
  i18nString(
    'Network failure while creating token. Retry and check your internet connection.',
  )

export const openAiApiKeyRequired = (): string =>
  i18nString('OpenAI API key is required.')
