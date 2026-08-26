import { WebWorkerRpcClient } from '@lvce-editor/rpc'
import { commandMap } from './parts/CommandMap/CommandMap.ts'

export { commandMap } from './parts/CommandMap/CommandMap.ts'

const globalScope = globalThis as typeof globalThis & { rpc?: unknown }

if (!globalScope.rpc) {
  globalScope.rpc = await WebWorkerRpcClient.create({ commandMap })
}
