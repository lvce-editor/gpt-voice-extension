/* eslint-disable @typescript-eslint/prefer-readonly-parameter-types */
import type {
  BackendVoiceConfiguration,
  CaptureFixtureOptions,
  VoiceWorkConfiguration,
  VoiceWorkResult,
  VoiceSessionState,
} from 'voice-shared'
import {
  createFixtureRecording,
  type FixtureRecording,
} from '../FixtureRecording/FixtureRecording.ts'
import {
  createFixtureReplay,
  type FixtureReplay,
} from '../FixtureReplay/FixtureReplay.ts'
import {
  formatFundedVoiceError,
  FundedVoiceError,
  getFundedVoiceCloseError,
  getFundedVoiceError,
  getFundedVoiceErrorDetails,
  openFundedVoiceSocket,
  waitForFundedSessionCreated,
} from '../FundedVoice/FundedVoice.ts'
import * as GptVoiceStrings from '../GptVoiceStrings/GptVoiceStrings.ts'
import { isOfflineConnectionError } from '../OfflineError/OfflineError.ts'
import { createOpenAiApiKeyStorage } from '../OpenAiApiKeyStorage/OpenAiApiKeyStorage.ts'
import * as Rpc from '../Rpc/Rpc.ts'
import {
  getToolCallOutput,
  isToolCallErrorOutput,
  parseToolCall,
} from '../ToolCall/ToolCall.ts'
import {
  createSessionConfig,
  defaultSessionModel,
  getEphemeralKey,
  getOpenAiErrorMessage,
  getSdp,
  RealtimeModelPreset,
} from '../WebRtc/WebRtc.ts'

const fundedConfigurationRefreshInterval = 1000
const trailingSlashRegex = /\/$/

interface Session {
  disposed: boolean
  fixtureRecording: FixtureRecording | undefined
  fixtureReplay: FixtureReplay | undefined
  fundedConfiguration: BackendVoiceConfiguration | undefined
  fundedConfigurationRefreshTimeout: ReturnType<typeof setTimeout> | undefined
  fundedControlSocket: WebSocket | undefined
  fundedSocketIntentionalClose: boolean
  readonly handledToolCallIds: Set<string>
  readonly id: number
  readonly isTestMode: boolean
  state: VoiceSessionState
}

const sessions = new Map<number, Session>()

const openAiApiKeyStorage = createOpenAiApiKeyStorage({
  deleteSecret: (key) => Rpc.invoke<void>('VoiceHost.deleteSecret', key),
  getSecret: (key) =>
    Rpc.invoke<string | undefined>('VoiceHost.getSecret', key),
  storeSecret: (key, value) =>
    Rpc.invoke<void>('VoiceHost.storeSecret', key, value),
})

const resolveBackendConfiguration = (): Promise<
  BackendVoiceConfiguration | undefined
> => Rpc.invoke('VoiceHost.resolveBackendConfiguration')

const publish = async (
  session: Session,
  transcriptScroll = false,
): Promise<void> => {
  if (!session.disposed) {
    await Rpc.invoke(
      'VoiceHost.updateState',
      session.id,
      session.state,
      transcriptScroll,
    )
  }
}

const publishLater = (session: Session, transcriptScroll = false): void => {
  void publish(session, transcriptScroll).catch(console.error)
}

const createTokenErrorMessage = (error: unknown): string => {
  if (error instanceof FundedVoiceError) {
    return formatFundedVoiceError(error)
  }
  if (!(error instanceof Error)) {
    return GptVoiceStrings.failedToCreateTokenWithDetails()
  }
  if (error.message.includes('401') || error.message.includes('403')) {
    return GptVoiceStrings.invalidOpenAiApiKey()
  }
  if (error.message.toLowerCase().includes('failed to fetch')) {
    return GptVoiceStrings.networkFailure()
  }
  if (error.message === 'NO_API_KEY') {
    return GptVoiceStrings.missingOpenAiApiKey()
  }
  return error.message || GptVoiceStrings.failedToCreateToken()
}

const getFundedErrorState = (
  error: Readonly<FundedVoiceError>,
): Pick<VoiceSessionState, 'fundedError' | 'fundedErrorDetails'> => ({
  fundedError: formatFundedVoiceError(error),
  fundedErrorDetails: getFundedVoiceErrorDetails(error),
})

const isAllowanceExceededError = (error: Readonly<FundedVoiceError>): boolean =>
  error.code === 'E_LVCE_USAGE_EXCEEDED'

const setOfflineErrorState = (session: Session, error: unknown): void => {
  session.state = {
    ...session.state,
    allowanceExceeded: false,
    fundedError: '',
    fundedErrorDetails: undefined,
    inProgress: false,
    isCreatingToken: false,
    offlineError: true,
    tokenError: createTokenErrorMessage(error),
  }
  publishLater(session)
}

const scheduleFundedConfigurationRefresh = (session: Session): void => {
  if (
    session.disposed ||
    session.isTestMode ||
    session.fundedConfiguration ||
    session.fundedConfigurationRefreshTimeout
  ) {
    return
  }
  session.fundedConfigurationRefreshTimeout = setTimeout(() => {
    session.fundedConfigurationRefreshTimeout = undefined
    void refreshFundedConfiguration(session).catch(console.error)
  }, fundedConfigurationRefreshInterval)
}

const refreshFundedConfiguration = async (session: Session): Promise<void> => {
  const configuration = await resolveBackendConfiguration()
  if (session.disposed) {
    return
  }
  if (!configuration) {
    scheduleFundedConfigurationRefresh(session)
    return
  }
  session.fundedConfiguration = configuration
  session.state = {
    ...session.state,
    fundedAvailable: true,
    fundedError: '',
    fundedErrorDetails: undefined,
    offlineError: false,
    voiceProvider: 'funded',
  }
  publishLater(session)
}

const getStoredApiKey = async (session: Session): Promise<string> => {
  const apiKey = await openAiApiKeyStorage.read()
  if (typeof apiKey !== 'string' || apiKey.trim().length === 0) {
    session.state = { ...session.state, hasOpenAiApiKey: false }
    throw new Error('NO_API_KEY')
  }
  session.state = { ...session.state, hasOpenAiApiKey: true }
  return apiKey
}

const sendToVoiceTransport = async (
  session: Session,
  data: string,
): Promise<void> => {
  session.fixtureRecording?.recordClientMessage(data)
  if (session.fixtureReplay) {
    session.fixtureReplay.acceptClientMessage(data)
    return
  }
  if (session.state.voiceProvider === 'funded') {
    const socket = session.fundedControlSocket
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      throw new Error('Backend-funded voice control socket is not connected')
    }
    socket.send(data)
    return
  }
  await Rpc.invoke('VoiceHost.sendWebRtcMessage', session.id, data)
}

const addTranscript = (
  session: Session,
  id: string,
  value: string,
  type: 'user' | 'ai',
): void => {
  session.state = {
    ...session.state,
    messages: [...session.state.messages, { id, text: value, type }],
  }
  publishLater(session, true)
}

const updateTranscript = (
  session: Session,
  id: string,
  value: string,
): void => {
  const index = session.state.messages.findIndex(
    (item) => item.type !== 'tool' && item.id === id,
  )
  const old = session.state.messages[index]
  if (index === -1 || !old || old.type === 'tool') {
    return
  }
  session.state = {
    ...session.state,
    messages: session.state.messages.with(index, { ...old, text: value }),
  }
  publishLater(session, true)
}

const createOrUpdateTranscript = (
  session: Session,
  parsed: Readonly<Record<string, unknown>>,
  type: 'user' | 'ai',
): void => {
  const delta = typeof parsed.delta === 'string' ? parsed.delta : ''
  const itemId = typeof parsed.item_id === 'string' ? parsed.item_id : ''
  const entry = session.state.messages.find(
    (item) => item.type !== 'tool' && item.id === itemId,
  )
  if (entry && entry.type !== 'tool') {
    updateTranscript(session, entry.id, entry.text + delta)
  } else {
    addTranscript(session, itemId, delta, type)
  }
}

const stop = async (session: Session): Promise<void> => {
  session.state = {
    ...session.state,
    animationEnabled: false,
    animationScale: 1,
    inProgress: false,
  }
  if (session.fundedControlSocket) {
    session.fundedSocketIntentionalClose = true
    session.fundedControlSocket.close()
    session.fundedControlSocket = undefined
  }
  if (!session.state.isTest) {
    await Rpc.invoke('VoiceHost.stopWebRtc', session.id, session.state.uid)
  }
  await publish(session)
}

const handleFunctionCall = async (
  session: Session,
  parsed: unknown,
): Promise<void> => {
  const toolCall = parseToolCall(parsed)
  if (!toolCall || session.handledToolCallIds.has(toolCall.callId)) {
    return
  }
  session.handledToolCallIds.add(toolCall.callId)
  const isSilentWait = toolCall.name === 'wait_for_user'
  if (!isSilentWait) {
    session.state = {
      ...session.state,
      messages: [
        ...session.state.messages,
        {
          argumentsValue: toolCall.argumentsValue,
          expanded: false,
          id: toolCall.callId,
          name: toolCall.name,
          output: '',
          status: 'in-progress',
          type: 'tool',
        },
      ],
    }
    publishLater(session, true)
  }
  let responseMessages: readonly string[]
  try {
    responseMessages =
      toolCall.name === 'do_work'
        ? await executeWorkTask(
            session,
            toolCall.callId,
            toolCall.argumentsValue,
          )
        : await Rpc.invoke('VoiceHost.executeFunctionToolCall', parsed)
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    session.state = {
      ...session.state,
      messages: session.state.messages.map((message) =>
        message.type === 'tool' && message.id === toolCall.callId
          ? { ...message, output: errorMessage, status: 'failed' }
          : message,
      ),
    }
    publishLater(session, true)
    throw error
  }
  const output = getToolCallOutput(responseMessages, toolCall.callId)
  session.state = {
    ...session.state,
    messages: session.state.messages.map((message) =>
      message.type === 'tool' && message.id === toolCall.callId
        ? {
            ...message,
            output,
            status: isToolCallErrorOutput(output) ? 'failed' : 'completed',
          }
        : message,
    ),
  }
  publishLater(session, true)
  if (toolCall.name === 'stop_talking') {
    await stop(session)
    return
  }
  if (session.state.isTest && !session.fixtureReplay) {
    return
  }
  for (const message of responseMessages) {
    await sendToVoiceTransport(session, message)
  }
}

const processData = async (session: Session, data: string): Promise<void> => {
  const parsed: unknown = JSON.parse(data)
  session.fixtureRecording?.recordServerEvent(parsed)
  session.state = {
    ...session.state,
    parsedData: [...session.state.parsedData, parsed],
  }
  if (!parsed || typeof parsed !== 'object') {
    return
  }
  const event = parsed as Readonly<Record<string, unknown>>
  if (event.type === 'error') {
    session.state = {
      ...session.state,
      tokenError: getOpenAiErrorMessage(
        event,
        GptVoiceStrings.failedToCreateToken(),
      ),
    }
    publishLater(session)
    await stop(session)
    return
  }
  if (event.type === 'response.output_audio_transcript.delta') {
    createOrUpdateTranscript(session, event, 'ai')
  } else if (
    event.type === 'conversation.item.input_audio_transcription.delta'
  ) {
    createOrUpdateTranscript(session, event, 'user')
  }
  await handleFunctionCall(session, event)
}

const handleFundedControlMessage = (
  session: Session,
  event: Readonly<{ readonly data: unknown }>,
): void => {
  let parsed: unknown
  try {
    parsed = JSON.parse(String(event.data))
  } catch {
    return
  }
  if (!parsed || typeof parsed !== 'object') {
    return
  }
  const value = parsed as Readonly<Record<string, unknown>>
  if (value.type === 'lvce.usage.updated') {
    return
  }
  if (value.type === 'lvce.usage.exceeded') {
    const error = getFundedVoiceError(
      value,
      GptVoiceStrings.monthlyAllowanceExceeded(),
      'E_LVCE_USAGE_EXCEEDED',
    )
    session.state = {
      ...session.state,
      allowanceExceeded: true,
      ...getFundedErrorState(error),
    }
    publishLater(session)
    void stop(session).catch(console.error)
    return
  }
  if (value.type === 'error') {
    const error = getFundedVoiceError(
      value,
      GptVoiceStrings.fundedVoiceUnavailable(),
      'unknown_server_error',
    )
    if (isOfflineConnectionError(error)) {
      setOfflineErrorState(session, error)
    } else {
      session.state = {
        ...session.state,
        allowanceExceeded: isAllowanceExceededError(error),
        ...getFundedErrorState(error),
      }
      publishLater(session)
    }
    void stop(session).catch(console.error)
  }
}

const handleFundedControlClose = (
  session: Session,
  event: Readonly<CloseEvent>,
): void => {
  if (session.fundedSocketIntentionalClose) {
    return
  }
  session.fundedControlSocket = undefined
  if (!session.state.inProgress) {
    return
  }
  const error = getFundedVoiceCloseError(event)
  if (isOfflineConnectionError(error)) {
    setOfflineErrorState(session, error)
  } else {
    const fundedErrorState = session.state.fundedError
      ? {
          fundedError: session.state.fundedError,
          fundedErrorDetails: session.state.fundedErrorDetails,
        }
      : getFundedErrorState(error)
    session.state = {
      ...session.state,
      ...fundedErrorState,
    }
    publishLater(session)
  }
  void stop(session).catch(console.error)
}

const getAnswerSdp = async (
  session: Session,
  offerSdp: string,
  ephemeralKey: string,
  sessionConfiguration: Readonly<Record<string, unknown>>,
): Promise<string> => {
  if (session.state.voiceProvider === 'byok') {
    return getSdp(offerSdp, ephemeralKey)
  }
  if (!session.fundedConfiguration) {
    throw new FundedVoiceError(
      'Backend-funded voice is unavailable.',
      'configuration_unavailable',
    )
  }
  session.fundedSocketIntentionalClose = false
  const socket = await openFundedVoiceSocket(session.fundedConfiguration)
  session.fundedControlSocket = socket
  const result = await waitForFundedSessionCreated(
    socket,
    offerSdp,
    sessionConfiguration,
  )
  socket.addEventListener('message', (event) =>
    handleFundedControlMessage(session, event),
  )
  socket.addEventListener('close', (event) =>
    handleFundedControlClose(session, event),
  )
  return result.answerSdp
}

const refreshFundedConfigurationForSession = async (
  session: Session,
): Promise<void> => {
  if (session.state.voiceProvider !== 'funded') {
    return
  }
  const configuration = await resolveBackendConfiguration()
  session.fundedConfiguration = configuration
  if (!configuration) {
    throw new FundedVoiceError(
      'Backend-funded voice is unavailable.',
      'configuration_unavailable',
    )
  }
}

const getBackendResponsesEndpoint = (baseUrl: string): string => {
  return `${baseUrl.replace(trailingSlashRegex, '')}/v1/responses`
}

const getWorkTask = (argumentsValue: string): string => {
  let parsed: unknown
  try {
    parsed = JSON.parse(argumentsValue)
  } catch {
    throw new TypeError('do_work arguments must be valid JSON.')
  }
  if (
    !parsed ||
    typeof parsed !== 'object' ||
    !('task' in parsed) ||
    typeof parsed.task !== 'string' ||
    !parsed.task.trim()
  ) {
    throw new TypeError('do_work requires a non-empty task.')
  }
  return parsed.task.trim()
}

const createWorkResponseMessages = (
  callId: string,
  result: VoiceWorkResult,
): readonly string[] => {
  return [
    JSON.stringify({
      item: {
        call_id: callId,
        output: JSON.stringify(result),
        type: 'function_call_output',
      },
      type: 'conversation.item.create',
    }),
    JSON.stringify({ type: 'response.create' }),
  ]
}

const getWorkConfiguration = async (
  session: Session,
): Promise<VoiceWorkConfiguration> => {
  if (session.state.voiceProvider === 'byok') {
    return {
      accessToken: await getStoredApiKey(session),
      endpoint: 'https://api.openai.com/v1/responses',
    }
  }
  await refreshFundedConfigurationForSession(session)
  const configuration = session.fundedConfiguration
  if (!configuration) {
    throw new Error('Backend-funded coding is unavailable.')
  }
  return {
    accessToken: configuration.accessToken,
    endpoint: getBackendResponsesEndpoint(configuration.baseUrl),
  }
}

async function executeWorkTask(
  session: Session,
  callId: string,
  argumentsValue: string,
): Promise<readonly string[]> {
  let result: VoiceWorkResult
  try {
    const task = getWorkTask(argumentsValue)
    const configuration = await getWorkConfiguration(session)
    result = await Rpc.invoke<VoiceWorkResult>(
      'VoiceHost.executeWorkTask',
      task,
      configuration,
    )
  } catch (error) {
    result = {
      success: false,
      summary: error instanceof Error ? error.message : String(error),
    }
  }
  return createWorkResponseMessages(callId, result)
}

const beginVoiceSession = async (session: Session): Promise<void> => {
  await refreshFundedConfigurationForSession(session)
  const registeredTools = await Rpc.invoke<readonly unknown[]>(
    'VoiceHost.getRegisteredTools',
  )
  const sessionConfig = createSessionConfig(
    session.state.sessionModel,
    registeredTools as readonly never[],
  )
  const ephemeralKey =
    session.state.voiceProvider === 'byok'
      ? await getEphemeralKey(await getStoredApiKey(session), sessionConfig)
      : ''
  session.state = { ...session.state, inProgress: true }
  publishLater(session)
  const offerSdp = await Rpc.invoke<string>(
    'VoiceHost.startWebRtc',
    session.id,
    session.state.uid,
    ephemeralKey,
  )
  if (!offerSdp) {
    throw new Error('offer sdp is required')
  }
  const answerSdp = await getAnswerSdp(
    session,
    offerSdp,
    ephemeralKey,
    sessionConfig.session,
  )
  await Rpc.invoke(
    'VoiceHost.setRemoteDescription',
    session.state.uid,
    answerSdp,
  )
  session.state = {
    ...session.state,
    animationEnabled: !session.state.isTest,
    isCreatingToken: false,
  }
  await publish(session)
}

const handleVoiceStartError = async (
  session: Session,
  error: unknown,
): Promise<void> => {
  const nextApiKeyStatus =
    error instanceof Error && error.message === 'NO_API_KEY'
      ? false
      : session.state.hasOpenAiApiKey
  if (!session.state.isTest && session.state.inProgress) {
    try {
      await Rpc.invoke('VoiceHost.stopWebRtc', session.id, session.state.uid)
    } catch {
      // Keep the original startup error as the actionable failure.
    }
  }
  if (session.fundedControlSocket) {
    session.fundedSocketIntentionalClose = true
    session.fundedControlSocket.close()
    session.fundedControlSocket = undefined
  }
  const message = createTokenErrorMessage(error)
  const offlineError = isOfflineConnectionError(error)
  let fundedErrorState: Pick<
    VoiceSessionState,
    'fundedError' | 'fundedErrorDetails'
  > = {
    fundedError: session.state.fundedError,
    fundedErrorDetails: session.state.fundedErrorDetails,
  }
  if (session.state.voiceProvider === 'funded' && !offlineError) {
    fundedErrorState =
      error instanceof FundedVoiceError
        ? getFundedErrorState(error)
        : { fundedError: message, fundedErrorDetails: undefined }
  }
  session.state = {
    ...session.state,
    allowanceExceeded:
      error instanceof FundedVoiceError && isAllowanceExceededError(error),
    ...fundedErrorState,
    hasOpenAiApiKey: nextApiKeyStatus,
    inProgress: false,
    isCreatingToken: false,
    offlineError,
    tokenError: offlineError ? '' : message,
  }
  console.error(error)
  await publish(session)
}

const handleStart = async (session: Session): Promise<void> => {
  const { inProgress, isCreatingToken, isSavingApiKey, voiceProvider } =
    session.state
  if (isCreatingToken || isSavingApiKey) {
    return
  }
  if (inProgress) {
    await stop(session)
    return
  }
  if (session.state.isTest) {
    session.state = {
      ...session.state,
      hasOpenAiApiKey: voiceProvider === 'byok',
      inProgress: true,
      offlineError: false,
      tokenError: '',
    }
    await publish(session)
    return
  }
  if (voiceProvider === 'byok' && !session.state.hasOpenAiApiKey) {
    session.state = {
      ...session.state,
      apiKeyError: '',
      tokenError: GptVoiceStrings.missingOpenAiApiKeyPrompt(),
    }
    await publish(session)
    return
  }
  session.state = {
    ...session.state,
    fundedError: voiceProvider === 'funded' ? '' : session.state.fundedError,
    fundedErrorDetails:
      voiceProvider === 'funded' ? undefined : session.state.fundedErrorDetails,
    isCreatingToken: true,
    offlineError: false,
    tokenError: '',
  }
  publishLater(session)
  try {
    await beginVoiceSession(session)
  } catch (error) {
    await handleVoiceStartError(session, error)
  }
}

const handleClearApiKey = async (session: Session): Promise<void> => {
  if (
    session.state.inProgress ||
    session.state.isCreatingToken ||
    session.state.isSavingApiKey
  ) {
    return
  }
  session.state = { ...session.state, isSavingApiKey: true }
  publishLater(session)
  try {
    await openAiApiKeyStorage.delete()
    session.state = {
      ...session.state,
      apiKeyError: '',
      apiKeyInput: '',
      hasOpenAiApiKey: false,
      isSavingApiKey: false,
      tokenError: '',
    }
  } catch {
    session.state = {
      ...session.state,
      apiKeyError: GptVoiceStrings.failedToClearOpenAiApiKey(),
      isSavingApiKey: false,
    }
  }
  await publish(session)
}

const openAiApiKeyRegex = /^sk-[A-Za-z0-9_-]{10,}$/

const handleSaveApiKey = async (session: Session): Promise<void> => {
  const apiKey = session.state.apiKeyInput.trim()
  if (!apiKey || !openAiApiKeyRegex.test(apiKey)) {
    session.state = {
      ...session.state,
      apiKeyError: apiKey
        ? GptVoiceStrings.invalidOpenAiApiKeyFormat()
        : GptVoiceStrings.openAiApiKeyRequired(),
      tokenError: '',
    }
    await publish(session)
    return
  }
  session.state = { ...session.state, apiKeyError: '', isSavingApiKey: true }
  publishLater(session)
  try {
    await openAiApiKeyStorage.write(apiKey)
    session.state = {
      ...session.state,
      apiKeyError: '',
      apiKeyInput: '',
      hasOpenAiApiKey: true,
      isSavingApiKey: false,
      tokenError: '',
    }
  } catch {
    session.state = {
      ...session.state,
      apiKeyError: GptVoiceStrings.failedToSaveOpenAiApiKey(),
      isSavingApiKey: false,
    }
  }
  await publish(session)
}

const captureFixture = async (
  session: Session,
  options: CaptureFixtureOptions,
): Promise<void> => {
  if (session.fixtureRecording) {
    throw new Error('A voice fixture recording is already active')
  }
  const recording = createFixtureRecording()
  session.fixtureRecording = recording
  let recordingError: Error | undefined
  try {
    await handleStart(session)
    await recording.waitForCompletion()
  } catch (error) {
    recordingError =
      error instanceof Error ? error : new Error('Unknown recording error')
  } finally {
    try {
      await stop(session)
    } catch (error) {
      recordingError ??=
        error instanceof Error ? error : new Error('Unknown recording error')
    } finally {
      session.fixtureRecording = undefined
      await Rpc.invoke(
        'VoiceHost.writeFile',
        options.outputUri,
        `${JSON.stringify(
          {
            ...(recordingError && { error: recordingError.message }),
            source: options.source,
            trace: recording.snapshot(),
          },
          null,
          2,
        )}\n`,
      )
    }
  }
  if (recordingError) {
    throw recordingError
  }
}

const replayFixture = async (
  session: Session,
  fixture: unknown,
): Promise<void> => {
  if (session.fixtureReplay) {
    throw new Error('A voice fixture replay is already active')
  }
  session.state = {
    ...session.state,
    hasOpenAiApiKey: true,
    isTest: true,
  }
  const replay = createFixtureReplay(fixture)
  session.fixtureReplay = replay
  try {
    await replay.run((data) => processData(session, data))
  } finally {
    session.fixtureReplay = undefined
  }
  await publish(session)
}

const getSession = (id: number): Session => {
  const session = sessions.get(id)
  if (!session) {
    throw new Error(`Voice session not found: ${id}`)
  }
  return session
}

const clearChat = async (session: Session): Promise<void> => {
  if (session.state.messages.length === 0) {
    return
  }
  session.state = { ...session.state, messages: [] }
  await publish(session)
}

export const create = async (
  id: number,
  isTest: boolean,
  testVoiceProvider: 'byok' | 'funded',
): Promise<VoiceSessionState> => {
  if (sessions.has(id)) {
    throw new Error(`Voice session already exists: ${id}`)
  }
  const hasTestApiKey = isTest && testVoiceProvider === 'byok'
  let hasOpenAiApiKey: boolean
  try {
    const existingApiKey = await openAiApiKeyStorage.read()
    hasOpenAiApiKey =
      (existingApiKey !== undefined && existingApiKey.trim().length > 0) ||
      hasTestApiKey
  } catch {
    hasOpenAiApiKey = hasTestApiKey
  }
  let fundedConfiguration: BackendVoiceConfiguration | undefined
  if (isTest) {
    fundedConfiguration =
      testVoiceProvider === 'funded'
        ? {
            accessToken: 'mock-access-token',
            baseUrl: 'https://lvce-editor.dev',
          }
        : undefined
  } else {
    fundedConfiguration = await resolveBackendConfiguration()
  }
  const session: Session = {
    disposed: false,
    fixtureRecording: undefined,
    fixtureReplay: undefined,
    fundedConfiguration,
    fundedConfigurationRefreshTimeout: undefined,
    fundedControlSocket: undefined,
    fundedSocketIntentionalClose: false,
    handledToolCallIds: new Set(),
    id,
    isTestMode: isTest,
    state: {
      allowanceExceeded: false,
      animationEnabled: false,
      animationFrame: -1,
      animationScale: 1,
      apiKeyError: '',
      apiKeyInput: '',
      fundedAvailable: Boolean(fundedConfiguration),
      fundedError: '',
      fundedErrorDetails: undefined,
      hasOpenAiApiKey,
      inProgress: false,
      isCreatingToken: false,
      isSavingApiKey: false,
      isTest,
      messages: [],
      offlineError: false,
      parsedData: [],
      sessionModel: defaultSessionModel,
      tokenError: '',
      transcribedText: '',
      uid: -1,
      voiceProvider: fundedConfiguration ? 'funded' : 'byok',
    },
  }
  sessions.set(id, session)
  scheduleFundedConfigurationRefresh(session)
  return session.state
}

export const dispatch = async (
  id: number,
  action: string,
  ...params: readonly unknown[]
): Promise<VoiceSessionState> => {
  const session = getSession(id)
  switch (action) {
    case 'addTranscript':
      addTranscript(
        session,
        String(params[0]),
        String(params[1]),
        params[2] === 'user' ? 'user' : 'ai',
      )
      break
    case 'captureFixture':
      await captureFixture(session, params[0] as CaptureFixtureOptions)
      break
    case 'clearApiKey':
      await handleClearApiKey(session)
      break
    case 'clearChat':
      await clearChat(session)
      break
    case 'data':
      await processData(session, String(params[0]))
      break
    case 'inputApiKey':
      if (!session.state.isSavingApiKey) {
        session.state = {
          ...session.state,
          apiKeyError: '',
          apiKeyInput: String(params[0]),
          tokenError: '',
        }
        await publish(session)
      }
      break
    case 'replayFixture':
      await replayFixture(session, params[0])
      break
    case 'saveApiKey':
      await handleSaveApiKey(session)
      break
    case 'setAnimation':
      session.state = {
        ...session.state,
        animationEnabled: Boolean(params[0]),
        animationScale: Number(params[1]),
      }
      await publish(session)
      break
    case 'setFundedError':
      handleFundedControlMessage(session, {
        data: JSON.stringify(params[0]),
      })
      break
    case 'setModel':
      if (
        !session.state.inProgress &&
        params[0] !== session.state.sessionModel
      ) {
        session.state = {
          ...session.state,
          sessionModel:
            params[0] === RealtimeModelPreset.Standard
              ? RealtimeModelPreset.Standard
              : RealtimeModelPreset.Mini,
        }
        await publish(session)
      }
      break
    case 'setOfflineError':
      setOfflineErrorState(session, params[0])
      break
    case 'start':
      await handleStart(session)
      break
    case 'stop':
      await stop(session)
      break
    case 'toggleToolCall':
      session.state = {
        ...session.state,
        messages: session.state.messages.map((message) =>
          message.type === 'tool' && message.id === params[0]
            ? { ...message, expanded: !message.expanded }
            : message,
        ),
      }
      await publish(session)
      break
    case 'useOwnApiKey':
      if (!session.state.inProgress && !session.state.isCreatingToken) {
        session.state = {
          ...session.state,
          allowanceExceeded: false,
          fundedError: '',
          fundedErrorDetails: undefined,
          offlineError: false,
          tokenError: '',
          voiceProvider: 'byok',
        }
        await publish(session)
      }
      break
    default:
      throw new Error(`Unknown voice session action: ${action}`)
  }
  return session.state
}

export const dispose = async (id: number): Promise<void> => {
  const session = sessions.get(id)
  if (!session) {
    return
  }
  session.disposed = true
  if (session.fundedConfigurationRefreshTimeout) {
    clearTimeout(session.fundedConfigurationRefreshTimeout)
    session.fundedConfigurationRefreshTimeout = undefined
  }
  try {
    await stop(session)
  } finally {
    sessions.delete(id)
  }
}
