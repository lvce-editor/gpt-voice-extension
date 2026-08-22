import { NodeRpcProcess } from '@lvce-editor/rpc'
import { commandMap } from './parts/CommandMap/CommandMap.ts'

await NodeRpcProcess.create({ commandMap })
