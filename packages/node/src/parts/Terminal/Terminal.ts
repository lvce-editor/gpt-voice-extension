import { execFile } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'

export interface TerminalCommandResult {
  readonly exitCode: number | null
  readonly stderr: string
  readonly stdout: string
  readonly timedOut: boolean
}

const commandTimeout = 120_000
const maximumOutputSize = 1_048_576
const execFileAsync = promisify(execFile)

interface BashExecutionError extends Error {
  readonly code?: number | string
  readonly killed?: boolean
  readonly stderr?: string
  readonly stdout?: string
}

const getWorkspacePath = (workspaceUri: string): string => {
  let url: URL
  try {
    url = new URL(workspaceUri)
  } catch {
    throw new TypeError('The opened workspace URI is invalid.')
  }
  if (url.protocol !== 'file:') {
    throw new TypeError(
      'Bash commands can only run in a local file:// workspace.',
    )
  }
  return fileURLToPath(url)
}

export const executeBash = async (
  command: string,
  workspaceUri: string,
): Promise<TerminalCommandResult> => {
  if (typeof command !== 'string' || !command.trim()) {
    throw new TypeError('Bash command must be a non-empty string.')
  }
  const cwd = getWorkspacePath(workspaceUri)
  try {
    const { stderr, stdout } = await execFileAsync(
      '/bin/bash',
      ['-c', command],
      {
        cwd,
        encoding: 'utf8',
        killSignal: 'SIGTERM',
        maxBuffer: maximumOutputSize,
        timeout: commandTimeout,
      },
    )
    return { exitCode: 0, stderr, stdout, timedOut: false }
  } catch (error) {
    if (!(error instanceof Error)) {
      throw new Error(String(error))
    }
    const executionError = error as BashExecutionError
    const stderr = executionError.stderr || ''
    const stdout = executionError.stdout || ''
    if (executionError.killed) {
      return { exitCode: null, stderr, stdout, timedOut: true }
    }
    if (typeof executionError.code === 'number') {
      return {
        exitCode: executionError.code,
        stderr,
        stdout,
        timedOut: false,
      }
    }
    throw new Error(executionError.message, { cause: executionError })
  }
}

export const commandMap = {
  'Terminal.executeBash': executeBash,
}
