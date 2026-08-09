import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { getWorkspacePath } from '../GetWorkspacePath/GetWorkspacePath.ts'

export interface TerminalCommandResult {
  readonly exitCode: number | null
  readonly stderr: string
  readonly stdout: string
  readonly timedOut: boolean
}

interface BashExecutionError extends Error {
  readonly code?: number | string
  readonly killed?: boolean
  readonly stderr?: string
  readonly stdout?: string
}

const commandTimeout = 120_000
const maximumOutputSize = 1_048_576
const execFileAsync = promisify(execFile)
const bashPath =
  process.platform === 'win32'
    ? 'C:\\Program Files\\Git\\bin\\bash.exe'
    : '/bin/bash'

export const executeBash = async (
  command: string,
  workspaceUri: string,
): Promise<TerminalCommandResult> => {
  if (typeof command !== 'string' || !command.trim()) {
    throw new TypeError('Bash command must be a non-empty string.')
  }
  const cwd = getWorkspacePath(workspaceUri)
  try {
    const { stderr, stdout } = await execFileAsync(bashPath, ['-c', command], {
      cwd,
      encoding: 'utf8',
      killSignal: 'SIGTERM',
      maxBuffer: maximumOutputSize,
      timeout: commandTimeout,
    })
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
