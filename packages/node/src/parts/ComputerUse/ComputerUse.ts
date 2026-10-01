import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export interface McpTool {
  readonly description?: string
  readonly inputSchema: Readonly<Record<string, unknown>>
  readonly name: string
}

export interface McpContent {
  readonly data?: string
  readonly mimeType?: string
  readonly text?: string
  readonly type: string
}

interface PendingRequest {
  readonly reject: (error: Error) => void
  readonly resolve: (value: unknown) => void
  readonly timer: ReturnType<typeof setTimeout>
}

interface McpClient {
  readonly child: ChildProcessWithoutNullStreams
  readonly io: { buffer: string; nextId: number }
  readonly pending: Map<number, PendingRequest>
  readonly tools: readonly McpTool[]
}

interface State {
  clientPromise: Promise<McpClient> | undefined
  executablePath: string | undefined
  exitListener: (() => void) | undefined
  runningClient: McpClient | undefined
}

const requestTimeout = 30_000
const maxResponseBytes = 4 * 1024 * 1024
const enabledPreference = 'gptvoice.tools.computerUseLinux.enabled'
export const state: State = {
  clientPromise: undefined,
  executablePath: undefined,
  exitListener: undefined,
  runningClient: undefined,
}

const getExecutablePath = (): string => {
  const { executablePath } = state
  if (executablePath) {
    if (existsSync(executablePath)) return executablePath
    throw new Error(
      'The bundled computer-use-linux executable is missing. Rebuild or reinstall the gpt-voice extension on Linux.',
    )
  }
  const arch = ({ arm64: 'arm64', x64: 'x64' } as const)[
    process.arch as 'x64' | 'arm64'
  ]
  if (!arch) {
    throw new Error(
      `Computer use is unavailable on Linux ${process.arch}; supported architectures are x64 and arm64.`,
    )
  }
  const binaryName = `computer-use-linux-linux-${arch}`
  const moduleDir = path.dirname(fileURLToPath(import.meta.url))
  const assetDirectories = [
    path.join(moduleDir, 'computer-use-linux'),
    path.join(moduleDir, '..', 'computer-use-linux'),
  ]
  for (const assetDirectory of assetDirectories) {
    const binaryPath = path.join(assetDirectory, binaryName)
    if (existsSync(binaryPath)) return binaryPath
  }
  throw new Error(
    'The bundled computer-use-linux executable is missing. Rebuild or reinstall the gpt-voice extension on Linux.',
  )
}

// eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types -- the pending map is cleared as part of rejecting all requests.
const rejectPending = (client: Readonly<McpClient>, error: Error): void => {
  for (const request of client.pending.values()) {
    clearTimeout(request.timer)
    request.reject(error)
  }
  client.pending.clear()
}

// eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types -- parsed responses complete mutable pending requests.
const handleLine = (client: Readonly<McpClient>, line: string): void => {
  let message: unknown
  try {
    message = JSON.parse(line)
  } catch {
    return
  }
  if (
    !message ||
    typeof message !== 'object' ||
    !('id' in message) ||
    typeof message.id !== 'number'
  ) {
    return
  }
  const pending = client.pending.get(message.id)
  if (!pending) {
    return
  }
  clearTimeout(pending.timer)
  client.pending.delete(message.id)
  if (
    'error' in message &&
    message.error &&
    typeof message.error === 'object'
  ) {
    const error = message.error as { message?: unknown }
    pending.reject(
      new Error(
        typeof error.message === 'string'
          ? error.message
          : 'Computer-use server request failed.',
      ),
    )
    return
  }
  pending.resolve('result' in message ? message.result : undefined)
}

const request = (
  client: Readonly<McpClient>, // eslint-disable-line @typescript-eslint/prefer-readonly-parameter-types -- this request mutates the client's ID and pending map.
  method: string,
  params: Readonly<Record<string, unknown>> = {},
): Promise<unknown> => {
  const id = client.io.nextId++
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      client.pending.delete(id)
      reject(new Error(`Computer-use server timed out during ${method}.`))
    }, requestTimeout)
    client.pending.set(id, { reject, resolve, timer })
    client.child.stdin.write(
      `${JSON.stringify({ id, jsonrpc: '2.0', method, params })}\n`,
      (error) => {
        if (!error) return
        clearTimeout(timer)
        client.pending.delete(id)
        reject(error)
      },
    )
  })
}

const createClient = async (): Promise<McpClient> => {
  if (process.platform !== 'linux') {
    throw new Error('Computer use is supported only on Linux.')
  }
  const executable = getExecutablePath()
  const cosmicHelper = path.join(
    path.dirname(executable),
    'computer-use-linux-cosmic',
  )
  const child = spawn(executable, ['mcp'], {
    env: { ...process.env, COMPUTER_USE_LINUX_COSMIC_HELPER: cosmicHelper },
    stdio: 'pipe',
  })
  child.stderr.resume()
  const client: McpClient = {
    child,
    io: { buffer: '', nextId: 1 },
    pending: new Map(),
    tools: [],
  }
  state.runningClient = client
  const { exitListener } = state
  if (!exitListener) {
    const { runningClient } = state
    state.exitListener = (): void => {
      runningClient?.child.kill()
    }
    const { exitListener: registeredExitListener } = state
    if (registeredExitListener) process.once('exit', registeredExitListener)
  }
  child.stdout.setEncoding('utf8')
  child.stdout.on('data', (chunk: string) => {
    client.io.buffer += chunk
    if (Buffer.byteLength(client.io.buffer) > maxResponseBytes) {
      rejectPending(
        client,
        new Error('Computer-use server response exceeded the 4 MiB limit.'),
      )
      child.kill()
      return
    }
    let newline = client.io.buffer.indexOf('\n')
    while (newline >= 0) {
      handleLine(client, client.io.buffer.slice(0, newline))
      client.io.buffer = client.io.buffer.slice(newline + 1)
      newline = client.io.buffer.indexOf('\n')
    }
  })
  child.on('error', (error) =>
    rejectPending(
      client,
      new Error(`Could not start bundled computer-use-linux: ${error.message}`),
    ),
  )
  child.on('exit', (code, signal) => {
    rejectPending(
      client,
      new Error(
        `Computer-use server stopped (${signal ?? code ?? 'unknown'}).`,
      ),
    )
    const { runningClient } = state
    if (runningClient !== client) return
    state.runningClient = undefined
    state.clientPromise = undefined
    const { exitListener } = state
    if (exitListener) process.off('exit', exitListener)
    state.exitListener = undefined
  })
  try {
    await request(client, 'initialize', {
      capabilities: {},
      clientInfo: { name: 'gpt-voice', version: '0.0.0' },
      protocolVersion: '2024-11-05',
    })
    child.stdin.write(
      `${JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized', params: {} })}\n`,
    )
    const result = (await request(client, 'tools/list')) as {
      tools?: readonly McpTool[]
    }
    if (!result || !Array.isArray(result.tools))
      throw new Error(
        'Computer-use server returned an invalid tools/list response.',
      )
    return { ...client, tools: result.tools }
  } catch (error) {
    child.kill()
    const { runningClient } = state
    if (runningClient === client) {
      state.runningClient = undefined
      const { exitListener } = state
      if (exitListener) process.off('exit', exitListener)
      state.exitListener = undefined
    }
    throw error
  }
}

const getClient = async (): Promise<McpClient> => {
  const { clientPromise: currentClientPromise } = state
  if (currentClientPromise) return currentClientPromise
  const clientPromise = createClient()
  state.clientPromise = clientPromise
  try {
    return await clientPromise
  } catch (error) {
    const { clientPromise: latestClientPromise } = state
    if (latestClientPromise === clientPromise) state.clientPromise = undefined
    throw error
  }
}

export const getTools = async (): Promise<readonly McpTool[]> => {
  const client = await getClient()
  return client.tools
}

export const callTool = async (
  name: string,
  argumentsValue: unknown,
): Promise<Readonly<{ content: readonly McpContent[] }>> => {
  const client = await getClient()
  if (client.tools.every((tool) => tool.name !== name))
    throw new Error(`Unknown computer-use tool: ${name}`)
  const result = await request(client, 'tools/call', {
    arguments: argumentsValue,
    name,
  })
  if (
    !result ||
    typeof result !== 'object' ||
    !('content' in result) ||
    !Array.isArray(result.content)
  ) {
    throw new Error('Computer-use server returned an invalid tool result.')
  }
  return result as { content: readonly McpContent[] }
}

export const stop = async (): Promise<void> => {
  const { clientPromise, runningClient } = state
  let client = runningClient
  if (clientPromise) {
    try {
      client = await clientPromise
    } catch {
      // A failed startup already kills its child process.
    }
  }
  state.clientPromise = undefined
  if (!client) return
  rejectPending(client, new Error('Computer-use access was disabled.'))
  if (client.child.exitCode === null && client.child.signalCode === null) {
    await new Promise<void>((resolve) => {
      client?.child.once('exit', () => resolve())
      client?.child.kill()
    })
  }
  state.runningClient = undefined
  const { exitListener } = state
  if (exitListener) process.off('exit', exitListener)
  state.exitListener = undefined
}
