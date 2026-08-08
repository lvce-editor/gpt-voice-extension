import { expect, test } from '@jest/globals'
import { createE2eTestSource } from '../src/CreateE2eTest.ts'

test('createE2eTestSource - creates a self-contained replay test', () => {
  const source = createE2eTestSource({
    expect: {
      assistantText: 'It is sunny.',
      toolCalls: [
        {
          arguments: { location: 'Paris' },
          name: 'getweather',
          output: { temperature: 20 },
        },
      ],
      userText: 'Weather?',
    },
    name: 'weather-paris',
    schemaVersion: 1,
    source: { text: 'Weather?' },
    trace: [],
  })

  expect(source).toContain(
    "export const name = 'gpt-voice.fixture-weather-paris'",
  )
  expect(source).toContain('const fixture = {')
  expect(source).toContain('"Ran getweather"')
  expect(source).not.toContain("from '../fixtures")
})
