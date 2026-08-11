interface NormalizedPath {
  readonly nextIndex: number
  readonly value: string
}

const isSlash = (value: string | undefined): boolean => {
  return value?.toLowerCase() === 'slash'
}

const parseSpokenPath = (
  words: readonly string[],
  startIndex: number,
): NormalizedPath | undefined => {
  let index = startIndex
  let segmentCount = 0
  let value = ''
  while (isSlash(words[index]) && words[index + 1]) {
    value += `/${words[index + 1]}`
    segmentCount++
    index += 2
  }
  if (segmentCount < 2) {
    return undefined
  }
  return {
    nextIndex: index,
    value,
  }
}

export const normalizeSpokenPaths = (value: string): string => {
  const words = value.split(' ')
  const normalizedWords: string[] = []
  let index = 0
  while (index < words.length) {
    const normalizedPath = parseSpokenPath(words, index)
    if (normalizedPath) {
      normalizedWords.push(normalizedPath.value)
      index = normalizedPath.nextIndex
      continue
    }
    normalizedWords.push(words[index] || '')
    index++
  }
  return normalizedWords.join(' ')
}
