import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import ts from 'typescript'

const packagesRoot = path.resolve(import.meta.dirname, '..', '..')

const getPackageNames = (): ReadonlyMap<string, string> => {
  const names = new Map<string, string>()
  for (const entry of fs.readdirSync(packagesRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) {
      continue
    }
    const packageJsonPath = path.join(packagesRoot, entry.name, 'package.json')
    if (!fs.existsSync(packageJsonPath)) {
      continue
    }
    const packageJson = JSON.parse(
      fs.readFileSync(packageJsonPath, 'utf8'),
    ) as Readonly<{ name?: unknown }>
    if (typeof packageJson.name === 'string') {
      names.set(packageJson.name, entry.name)
    }
  }
  return names
}

const getTypeScriptFiles = (directory: string): readonly string[] => {
  if (!fs.existsSync(directory)) {
    return []
  }
  const files: string[] = []
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name)
    if (entry.isDirectory()) {
      if (entry.name !== 'coverage' && entry.name !== 'dist') {
        files.push(...getTypeScriptFiles(entryPath))
      }
    } else if (entry.name.endsWith('.ts')) {
      files.push(entryPath)
    }
  }
  return files
}

const getTargetPackage = (
  sourceFile: string,
  specifier: string,
  packageNames: ReadonlyMap<string, string>,
): string | undefined => {
  const barePackage = packageNames.get(specifier)
  if (barePackage) {
    return barePackage
  }
  if (!specifier.startsWith('.')) {
    return undefined
  }
  const resolved = path.resolve(path.dirname(sourceFile), specifier)
  const relative = path.relative(packagesRoot, resolved)
  if (relative.startsWith('..')) {
    return undefined
  }
  const [packageName] = relative.split(path.sep)
  return packageName
}

interface PackageImport {
  readonly isTypeOnly: boolean
  readonly specifier: string
}

const getPackageImports = (file: string): readonly PackageImport[] => {
  const source = ts.createSourceFile(
    file,
    fs.readFileSync(file, 'utf8'),
    ts.ScriptTarget.Latest,
    true,
  )
  const imports: PackageImport[] = []
  for (const statement of source.statements) {
    if (ts.isImportDeclaration(statement)) {
      imports.push({
        isTypeOnly: statement.importClause?.isTypeOnly === true,
        specifier: String((statement.moduleSpecifier as ts.StringLiteral).text),
      })
    } else if (ts.isExportDeclaration(statement) && statement.moduleSpecifier) {
      imports.push({
        isTypeOnly: statement.isTypeOnly,
        specifier: String((statement.moduleSpecifier as ts.StringLiteral).text),
      })
    }
  }
  return imports
}

test('workspace packages only share type contracts', () => {
  const packageNames = getPackageNames()
  const packageDirectories = new Set(packageNames.values())
  const violations: string[] = []

  for (const sourcePackage of packageDirectories) {
    const packageDirectory = path.join(packagesRoot, sourcePackage)
    for (const file of getTypeScriptFiles(packageDirectory)) {
      for (const packageImport of getPackageImports(file)) {
        const targetPackage = getTargetPackage(
          file,
          packageImport.specifier,
          packageNames,
        )
        if (!targetPackage || targetPackage === sourcePackage) {
          continue
        }
        const relativeFile = path.relative(packagesRoot, file)
        if (targetPackage !== 'shared') {
          violations.push(
            `${relativeFile} imports executable code from ${targetPackage}`,
          )
        } else if (!packageImport.isTypeOnly) {
          violations.push(
            `${relativeFile} must use a type-only import from voice-shared`,
          )
        }
      }
    }
  }

  assert.deepEqual(violations, [])
})
