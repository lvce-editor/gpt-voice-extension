import { expect, test } from '@jest/globals'
import { parseCliArgs } from '../src/ParseCliArgs.ts'

test('parseCliArgs - supports separated and inline values', () => {
  expect(
    parseCliArgs([
      '--name',
      'weather-paris',
      '--text=What is the weather?',
      '--regenerate-existing',
    ]),
  ).toEqual({
    name: 'weather-paris',
    regenerateExisting: true,
    text: 'What is the weather?',
  })
})

test('parseCliArgs - reuses existing fixtures by default', () => {
  expect(
    parseCliArgs(['--name=weather-paris', '--text=What is the weather?']),
  ).toEqual({
    name: 'weather-paris',
    regenerateExisting: false,
    text: 'What is the weather?',
  })
})

test('parseCliArgs - supports the legacy force option', () => {
  expect(
    parseCliArgs(['--name=weather-paris', '--text=test', '--force']),
  ).toMatchObject({ regenerateExisting: true })
})

test('parseCliArgs - validates required options', () => {
  expect(() => parseCliArgs([])).toThrow('Missing required --name')
  expect(() => parseCliArgs(['--name', 'Bad Name', '--text', 'hello'])).toThrow(
    'lowercase letters',
  )
  expect(() =>
    parseCliArgs(['--name', 'valid', '--text', ' '.repeat(3)]),
  ).toThrow('must not be empty')
})
