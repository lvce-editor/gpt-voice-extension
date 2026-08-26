import * as I18nString from '../I18NString/I18NString.ts'
import * as UiStrings from '../UiStrings/UiStrings.ts'

const getString = (value: string): string => {
  return I18nString.i18nString(value)
}

export const changeApiKey = (): string => getString(UiStrings.ChangeApiKey)
export const clearChat = (): string => getString(UiStrings.ClearChat)
export const creatingToken = (): string => getString(UiStrings.CreatingToken)
export const failedToClearOpenAiApiKey = (): string =>
  getString(UiStrings.FailedToClearOpenAiApiKey)
export const failedToCreateToken = (): string =>
  getString(UiStrings.FailedToCreateToken)
export const failedToCreateTokenWithDetails = (): string =>
  getString(UiStrings.FailedToCreateTokenWithDetails)
export const fundedVoiceClosed = (): string =>
  getString(UiStrings.FundedVoiceClosed)
export const fundedVoiceUnavailable = (): string =>
  getString(UiStrings.FundedVoiceUnavailable)
export const failedToSaveOpenAiApiKey = (): string =>
  getString(UiStrings.FailedToSaveOpenAiApiKey)
export const gptVoice = (): string => getString(UiStrings.GptVoice)
export const gptVoiceDisplayName = (): string =>
  getString(UiStrings.GptVoiceDisplayName)
export const idle = (): string => getString(UiStrings.Idle)
export const inProgress = (): string => getString(UiStrings.InProgress)
export const invalidOpenAiApiKey = (): string =>
  getString(UiStrings.InvalidOpenAiApiKey)
export const invalidOpenAiApiKeyFormat = (): string =>
  getString(UiStrings.InvalidOpenAiApiKeyFormat)
export const missingOpenAiApiKey = (): string =>
  getString(UiStrings.MissingOpenAiApiKey)
export const missingOpenAiApiKeyPrompt = (): string =>
  getString(UiStrings.MissingOpenAiApiKeyPrompt)
export const networkFailure = (): string => getString(UiStrings.NetworkFailure)
export const monthlyAllowanceExceeded = (): string =>
  getString(UiStrings.MonthlyAllowanceExceeded)
export const monthlyAllowanceDescription = (): string =>
  getString(UiStrings.MonthlyAllowanceDescription)
export const monthlyAllowanceErrorDescription = (): string =>
  getString(UiStrings.MonthlyAllowanceErrorDescription)
export const errorCode = (): string => getString(UiStrings.ErrorCode)
export const errorDescription = (): string =>
  getString(UiStrings.ErrorDescription)
export const errorDetails = (): string => getString(UiStrings.ErrorDetails)
export const httpStatus = (): string => getString(UiStrings.HttpStatus)
export const openAiApiKeyRequired = (): string =>
  getString(UiStrings.OpenAiApiKeyRequired)
export const openAiApiKeyRequiredForVoice = (): string =>
  getString(UiStrings.OpenAiApiKeyRequiredForVoice)
export const offlineDescription = (): string =>
  getString(UiStrings.OfflineDescription)
export const offlineErrorCode = (): string =>
  getString(UiStrings.OfflineErrorCode)
export const offlineTitle = (): string => getString(UiStrings.OfflineTitle)
export const realtimeMiniModel = (): string =>
  getString(UiStrings.RealtimeMiniModel)
export const realtimeStandardModel = (): string =>
  getString(UiStrings.RealtimeStandardModel)
export const saveApiKey = (): string => getString(UiStrings.SaveApiKey)
export const saving = (): string => getString(UiStrings.Saving)
export const savingKey = (): string => getString(UiStrings.SavingKey)
export const setUpOpenAiApiKey = (): string =>
  getString(UiStrings.SetUpOpenAiApiKey)
export const startTalking = (): string => getString(UiStrings.StartTalking)
export const stopTalking = (): string => getString(UiStrings.StopTalking)
export const tryAgain = (): string => getString(UiStrings.TryAgain)
export const useBetter = (): string => getString(UiStrings.UseBetter)
export const useCheap = (): string => getString(UiStrings.UseCheap)
export const useOwnApiKey = (): string => getString(UiStrings.UseOwnApiKey)
export const viewPlansAndPricing = (): string =>
  getString(UiStrings.ViewPlansAndPricing)
export const welcomeDescription = (): string =>
  getString(UiStrings.WelcomeDescription)
