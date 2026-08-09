import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { commandMap } from '../src/parts/CommandMap/CommandMap.ts'
import { executeBash } from '../src/parts/ExecuteBash/ExecuteBash.ts'

test('exports the node RPC command', () => {
  assert.equal(commandMap['Terminal.executeBash'], executeBash)
})
