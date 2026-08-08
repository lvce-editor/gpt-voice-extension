import { expect, test } from '@jest/globals'
import {
  createFixtureReplay,
  validateFixture,
} from '../src/parts/FixtureReplay/FixtureReplay.ts'

const createFixture = (trace: readonly unknown[]): unknown => ({
  schemaVersion: 1,
  trace,
})

test('fixture replay - replays server events and verifies canonical client events', async () => {
  const replay = createFixtureReplay(
    createFixture([
      {
        atMs: 0,
        direction: 'server',
        event: { type: 'server.event' },
      },
      {
        atMs: 1,
        direction: 'client',
        event: { item: { a: 1, b: 2 }, type: 'client.event' },
      },
    ]),
  )

  await replay.run(async (data) => {
    expect(JSON.parse(data)).toEqual({ type: 'server.event' })
    replay.acceptClientMessage(
      JSON.stringify({ item: { a: 1, b: 2 }, type: 'client.event' }),
    )
  })
})

test('fixture replay - reports missing, mismatched, extra, and invalid client events', async () => {
  const clientEntry = {
    atMs: 1,
    direction: 'client',
    event: { type: 'expected' },
  }
  await expect(
    createFixtureReplay(createFixture([clientEntry])).run(async () => {}),
  ).rejects.toThrow('Missing client event')

  const mismatch = createFixtureReplay(createFixture([clientEntry]))
  mismatch.acceptClientMessage(JSON.stringify({ type: 'actual' }))
  await expect(mismatch.run(async () => {})).rejects.toThrow(
    'Client event mismatch',
  )

  const extra = createFixtureReplay(createFixture([]))
  extra.acceptClientMessage(JSON.stringify({ type: 'extra' }))
  await expect(extra.run(async () => {})).rejects.toThrow(
    'unexpected client event',
  )

  const invalid = createFixtureReplay(createFixture([]))
  expect(() => invalid.acceptClientMessage('{')).toThrow('invalid client JSON')
})

test('fixture validation - rejects invalid fixture values', () => {
  expect(() => validateFixture(undefined)).toThrow('schemaVersion')
  expect(() => validateFixture({ schemaVersion: 1 })).toThrow('trace')
  expect(() => validateFixture(createFixture([null]))).toThrow(
    'must be an object',
  )
  expect(() =>
    validateFixture(
      createFixture([{ atMs: 0, direction: 'invalid', event: {} }]),
    ),
  ).toThrow('invalid direction')
  expect(() =>
    validateFixture(
      createFixture([{ atMs: NaN, direction: 'server', event: {} }]),
    ),
  ).toThrow('invalid timestamp')
  expect(() =>
    validateFixture(
      createFixture([{ atMs: 0, direction: 'server', event: null }]),
    ),
  ).toThrow('event must be an object')
})
