import type { Rpc } from '@lvce-editor/rpc'
import type { Duplex } from 'node:stream'
import {
  NodeForkedProcessRpcParent,
  WebSocketRpcParent,
} from '@lvce-editor/rpc'
import { equal, ok } from 'node:assert/strict'
import { createServer } from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { pathToFileURL } from 'node:url'

test('starts the packaged terminal process and invokes a command', async () => {
  const entryPoint = join(
    import.meta.dirname,
    '..',
    '..',
    'extension',
    'dist',
    'terminalNodeMain.js',
  )
  const server = createServer()
  const sockets = new Set<Duplex>()
  let controlRpc: Rpc | undefined
  let rpc: Rpc | undefined
  try {
    const childRpc = await NodeForkedProcessRpcParent.create({
      commandMap: {},
      path: entryPoint,
    })
    controlRpc = childRpc
    const { promise: attached, reject, resolve } = Promise.withResolvers<void>()
    server.on(
      'upgrade',
      // Node's upgrade callback exposes mutable request and socket objects.
      // eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types
      (request, socket) => {
        sockets.add(socket)
        socket.once('close', () => sockets.delete(socket))
        socket.pause()
        const serializableRequest = {
          headers: request.headers,
          method: request.method,
          url: request.url,
        }
        const attach = async (): Promise<void> => {
          try {
            await childRpc.invokeAndTransfer(
              'NodeRpcProcess.handleWebSocket',
              socket,
              serializableRequest,
            )
            resolve()
          } catch (error) {
            reject(error)
          }
        }
        void attach()
      },
    )
    await new Promise<void>((resolve, reject) => {
      server.once('error', reject)
      server.listen(0, '127.0.0.1', resolve)
    })
    const address = server.address()
    ok(address && typeof address === 'object')
    const webSocket = new WebSocket(`ws://127.0.0.1:${address.port}`)
    rpc = await WebSocketRpcParent.create({ commandMap: {}, webSocket })
    await attached

    const result = (await rpc.invoke(
      'Terminal.executeBash',
      'printf gpt-voice-process-ok',
      pathToFileURL(tmpdir()).toString(),
    )) as { readonly exitCode: number; readonly stdout: string }

    equal(result.stdout, 'gpt-voice-process-ok')
    equal(result.exitCode, 0)
  } finally {
    await rpc?.dispose()
    await controlRpc?.dispose()
    for (const socket of sockets) {
      socket.destroy()
    }
    server.closeAllConnections()
    await new Promise<void>((resolve) => server.close(() => resolve()))
  }
})
