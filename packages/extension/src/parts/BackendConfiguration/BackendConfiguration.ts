import { executeCommand, getAccessToken } from '@lvce-editor/api'

export interface BackendVoiceConfiguration {
  readonly accessToken: string
  readonly baseUrl: string
}

export interface BackendConfigurationHost {
  readonly executeCommand: (
    id: string,
    ...args: readonly unknown[]
  ) => Promise<unknown>
  readonly getAccessToken: (options: {
    readonly refresh: 'if-needed'
  }) => Promise<unknown>
}

const defaultHost: BackendConfigurationHost = {
  executeCommand,
  getAccessToken,
}

const getString = (value: unknown): string =>
  typeof value === 'string' ? value.trim() : ''

const removeTrailingSlashes = (value: string): string => {
  let end = value.length
  while (end > 0 && value[end - 1] === '/') {
    end--
  }
  return value.slice(0, end)
}

export const resolveBackendVoiceConfiguration = async (
  host: BackendConfigurationHost = defaultHost,
): Promise<BackendVoiceConfiguration | undefined> => {
  try {
    const [baseUrlValue, accessTokenValue] = await Promise.all([
      host.executeCommand('Layout.getBackendUrl'),
      host.getAccessToken({ refresh: 'if-needed' }),
    ])
    const baseUrl = removeTrailingSlashes(getString(baseUrlValue))
    const accessToken = getString(accessTokenValue)
    return baseUrl && accessToken ? { accessToken, baseUrl } : undefined
  } catch {
    return undefined
  }
}
