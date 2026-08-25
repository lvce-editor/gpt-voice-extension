import { expect, jest, test } from '@jest/globals'
import { createFixtureRecording } from '../src/parts/FixtureRecording/FixtureRecording.ts'

const noop = (): void => {}

test('fixture recording - records both directions and completes a normal turn', async () => {
  let now = 100
  const clearTimer = jest.fn()
  const recording = createFixtureRecording({
    clearTimer,
    now: () => now,
    setTimer: jest.fn(() => 1),
  })
  now = 110
  recording.recordServerEvent({
    delta: 'What is 1+1?',
    item_id: 'user',
    type: 'conversation.item.input_audio_transcription.delta',
  })
  now = 120
  recording.recordServerEvent({
    delta: '2',
    item_id: 'assistant',
    type: 'response.output_audio_transcript.delta',
  })
  now = 130
  recording.recordServerEvent({ type: 'response.done' })

  await expect(recording.waitForCompletion()).resolves.toBeUndefined()
  expect(clearTimer).toHaveBeenCalled()
  expect(recording.snapshot()).toHaveLength(3)
  expect(recording.snapshot()[0]?.atMs).toBe(10)
})

test('fixture recording - waits for assistant output after a tool response request', async () => {
  let now = 0
  const clearTimer = jest.fn()
  const recording = createFixtureRecording({
    clearTimer,
    now: () => now,
    setTimer: jest.fn(() => 1),
  })
  recording.recordServerEvent({
    delta: 'Weather?',
    type: 'conversation.item.input_audio_transcription.delta',
  })
  recording.recordServerEvent({
    delta: 'Let me check.',
    type: 'response.output_audio_transcript.delta',
  })
  recording.recordServerEvent({
    arguments: '{"location":"Paris"}',
    call_id: 'call',
    name: 'getweather',
    type: 'response.function_call_arguments.done',
  })
  recording.recordServerEvent({ type: 'response.done' })
  expect(clearTimer).not.toHaveBeenCalled()
  now = 5
  recording.recordClientMessage(
    JSON.stringify({
      item: { call_id: 'call', type: 'function_call_output' },
      type: 'conversation.item.create',
    }),
  )
  recording.recordClientMessage(JSON.stringify({ type: 'response.create' }))
  now = 6
  recording.recordServerEvent({ type: 'response.done' })
  now = 7
  recording.recordServerEvent({
    delta: 'Sunny',
    type: 'response.output_audio_transcript.delta',
  })
  now = 8
  recording.recordServerEvent({ type: 'response.done' })

  await expect(recording.waitForCompletion()).resolves.toBeUndefined()
  expect(recording.snapshot()).toContainEqual(
    expect.objectContaining({ direction: 'client' }),
  )
})

test('fixture recording - rejects invalid events and times out', async () => {
  let timeoutCallback = noop
  const recording = createFixtureRecording({
    clearTimer: jest.fn(),
    setTimer(callback) {
      timeoutCallback = callback
      return 1
    },
    timeoutMs: 10,
  })

  expect(() => recording.recordClientMessage('{')).toThrow()
  expect(() => recording.recordClientMessage('[]')).toThrow('must be an object')
  expect(() => recording.recordServerEvent(null)).toThrow('must be an object')
  timeoutCallback()
  await expect(recording.waitForCompletion()).rejects.toThrow(
    'Timed out recording voice fixture after 10ms',
  )
})

test('fixture recording - uses browser timing defaults', async () => {
  jest.useFakeTimers()
  try {
    const recording = createFixtureRecording()
    recording.recordServerEvent({
      delta: 'Hello',
      type: 'conversation.item.input_audio_transcription.delta',
    })
    recording.recordServerEvent({
      delta: 'Hi',
      type: 'response.output_audio_transcript.delta',
    })
    recording.recordServerEvent({ type: 'response.done' })
    await expect(recording.waitForCompletion()).resolves.toBeUndefined()
  } finally {
    jest.useRealTimers()
  }
})
