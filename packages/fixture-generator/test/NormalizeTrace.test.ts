import { expect, test } from '@jest/globals'
import { normalizeRecording } from '../src/NormalizeTrace.ts'

test('normalizeRecording - filters events, normalizes ids, and derives expectations', () => {
  const result = normalizeRecording({
    source: { name: 'weather-paris', text: 'Weather?' },
    trace: [
      {
        atMs: 0,
        direction: 'server',
        event: { type: 'session.created' },
      },
      {
        atMs: 1,
        direction: 'server',
        event: {
          delta: 'Weather?',
          item_id: 'volatile-user',
          type: 'conversation.item.input_audio_transcription.delta',
        },
      },
      {
        atMs: 2,
        direction: 'server',
        event: {
          arguments: '{"location":"Paris"}',
          call_id: 'volatile-call',
          name: 'getweather',
          type: 'response.function_call_arguments.done',
        },
      },
      {
        atMs: 3,
        direction: 'client',
        event: {
          item: {
            call_id: 'volatile-call',
            output: '{"temperature":20}',
            type: 'function_call_output',
          },
          type: 'conversation.item.create',
        },
      },
      {
        atMs: 4,
        direction: 'client',
        event: { type: 'response.create' },
      },
      {
        atMs: 5,
        direction: 'server',
        event: {
          delta: '20 degrees',
          item_id: 'volatile-assistant',
          type: 'response.output_audio_transcript.delta',
        },
      },
    ],
  })

  expect(result.trace).toHaveLength(5)
  expect(result.trace[0]?.event.item_id).toBe('item_1')
  expect(result.trace[1]?.event.call_id).toBe('call_1')
  expect(result.expect).toEqual({
    assistantText: '20 degrees',
    toolCalls: [
      {
        arguments: { location: 'Paris' },
        name: 'getweather',
        output: { temperature: 20 },
      },
    ],
    userText: 'Weather?',
  })
})

test('normalizeRecording - rejects failed and unusable recordings', () => {
  expect(() =>
    normalizeRecording({
      error: 'timeout',
      source: {},
      trace: [],
    }),
  ).toThrow('timeout')
  expect(() => normalizeRecording({ source: {}, trace: [] })).toThrow(
    'usable voice turn',
  )
})

test('normalizeRecording - supports output item function call events', () => {
  const result = normalizeRecording({
    source: { name: 'output-item' },
    trace: [
      {
        atMs: 0,
        direction: 'server',
        event: {
          delta: 'Weather?',
          item_id: 'user',
          type: 'conversation.item.input_audio_transcription.delta',
        },
      },
      {
        atMs: 1,
        direction: 'server',
        event: {
          item: {
            arguments: '{"location":"London"}',
            call_id: 'call',
            name: 'getweather',
            type: 'function_call',
          },
          type: 'response.output_item.done',
        },
      },
    ],
  })

  expect(result.trace[1]?.event).toEqual({
    item: {
      arguments: '{"location":"London"}',
      call_id: 'call_1',
      name: 'getweather',
      type: 'function_call',
    },
    type: 'response.output_item.done',
  })
})
