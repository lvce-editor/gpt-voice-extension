import { expect, test } from '@jest/globals'
import { parseCliArgs } from '../src/ParseCliArgs.ts'

test('parseCliArgs - supports separated and inline values', () => {
  expect(
    parseCliArgs([
      '--name',
      'weather-paris',
      '--text=What is the weather?',
      '--force',
    ]),
  ).toEqual({
    force: true,
    name: 'weather-paris',
    text: 'What is the weather?',
  })
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
