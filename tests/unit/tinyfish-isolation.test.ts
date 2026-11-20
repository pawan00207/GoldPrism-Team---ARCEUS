import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'

const root = process.cwd()
const protectedRoots = [
  path.join(root, 'src', 'lib', 'goldprism'),
  path.join(root, 'research', 'goldprism'),
]

function findDecisionFiles(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(directory, entry.name)
    if (entry.isDirectory()) return findDecisionFiles(fullPath)
    return /(?:signal|backtest|verdict)/i.test(entry.name) &&
      /\.(?:ts|tsx|py)$/.test(entry.name)
      ? [fullPath]
      : []
  })
}

test('signals, backtests, and verdict modules do not import or read TinyFish data', () => {
  const decisionFiles = protectedRoots.flatMap(findDecisionFiles)
  assert.ok(decisionFiles.length > 0, 'expected existing decision modules to be found')

  for (const file of decisionFiles) {
    const source = fs.readFileSync(file, 'utf8')
    assert.doesNotMatch(source, /tiny[\W_]*fish/i, `${path.relative(root, file)} references TinyFish`)
  }
})

test('cross_check values are isolated to trust eligibility and do not reach protected number modules', () => {
  for (const file of protectedRoots.flatMap(findDecisionFiles)) {
    const source = fs.readFileSync(file, 'utf8')
    assert.doesNotMatch(source, /cross[_ -]?check|settle[_ -]?source[_ -]?b/i,
      `${path.relative(root, file)} reads settlement cross-check values`)
  }
})
