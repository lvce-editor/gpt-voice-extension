export interface GeneratorOptions {
  readonly name: string
  readonly regenerateExisting: boolean
  readonly text: string
}

const fixtureNameRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

const getValue = (args: readonly string[], name: string): string => {
  const prefix = `--${name}=`
  const inline = args.find((arg) => arg.startsWith(prefix))
  if (inline) {
    return inline.slice(prefix.length)
  }
  const index = args.indexOf(`--${name}`)
  if (index === -1 || !args[index + 1]) {
    throw new Error(`Missing required --${name} option`)
  }
  return args[index + 1]
}

export const parseCliArgs = (args: readonly string[]): GeneratorOptions => {
  const name = getValue(args, 'name')
  if (!fixtureNameRegex.test(name)) {
    throw new Error(
      'Fixture name must contain lowercase letters, numbers, and single hyphens',
    )
  }
  const text = getValue(args, 'text')
  if (!text.trim()) {
    throw new Error('Fixture text must not be empty')
  }
  return {
    name,
    regenerateExisting:
      args.includes('--regenerate-existing') || args.includes('--force'),
    text,
  }
}
