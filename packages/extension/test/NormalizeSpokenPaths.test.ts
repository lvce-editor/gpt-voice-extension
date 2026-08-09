import { expect, test } from '@jest/globals'
import { normalizeSpokenPaths } from '../src/parts/NormalizeSpokenPaths/NormalizeSpokenPaths.ts'

test('normalizeSpokenPaths - converts an absolute spoken path', () => {
  expect(
    normalizeSpokenPaths(
      "It's located at slash home slash simon slash Videos.",
    ),
  ).toBe("It's located at /home/simon/Videos.")
})

test('normalizeSpokenPaths - converts multiple paths case insensitively', () => {
  expect(
    normalizeSpokenPaths(
      'Move Slash tmp SLASH input to slash var slash output now.',
    ),
  ).toBe('Move /tmp/input to /var/output now.')
})

test('normalizeSpokenPaths - leaves prose and formatted paths unchanged', () => {
  expect(normalizeSpokenPaths('Type slash to open search.')).toBe(
    'Type slash to open search.',
  )
  expect(normalizeSpokenPaths('Open /home/simon/Videos.')).toBe(
    'Open /home/simon/Videos.',
  )
})
