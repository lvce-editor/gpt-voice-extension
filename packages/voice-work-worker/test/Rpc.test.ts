import { expect, jest, test } from '@jest/globals'
import { invoke } from '../src/parts/Rpc/Rpc.ts'

test('forwards calls through the worker RPC', async () => {
  const rpcInvoke = jest.fn<
    (method: string, ...params: readonly unknown[]) => Promise<unknown>
  >(async () => 'result')
  Object.assign(globalThis, { rpc: { invoke: rpcInvoke } })

  await expect(invoke('method', 'value')).resolves.toBe('result')
  expect(rpcInvoke).toHaveBeenCalledWith('method', 'value')
})
