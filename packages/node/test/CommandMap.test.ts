import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { commandMap } from '../src/parts/CommandMap/CommandMap.ts'
import * as ComputerUse from '../src/parts/ComputerUse/ComputerUse.ts'
import { executeBash } from '../src/parts/ExecuteBash/ExecuteBash.ts'

test('exports the node RPC command', () => {
  assert.equal(commandMap['Terminal.executeBash'], executeBash)
  assert.equal(commandMap['ComputerUse.getTools'], ComputerUse.getTools)
  assert.equal(commandMap['ComputerUse.callTool'], ComputerUse.callTool)
  assert.equal(commandMap['ComputerUse.stop'], ComputerUse.stop)
})
