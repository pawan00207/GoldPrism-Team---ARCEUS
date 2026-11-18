import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const rulesPath = path.resolve(process.cwd(), 'firestore.rules');
const blueprintPath = path.resolve(process.cwd(), 'firebase-blueprint.json');

test('firestore.rules enforces all Eight Pillars and covers every collection in firebase-blueprint.json', () => {
  const rules = fs.readFileSync(rulesPath, 'utf8');
  const blueprint = JSON.parse(fs.readFileSync(blueprintPath, 'utf8')) as {
    firestore: Record<string, unknown>;
  };

  // Global default-deny safety net
  assert.match(rules, /match \/\{document=\*\*\} \{\s*allow read, write: if false;\s*\}/);

  // Verified owner email check + path ID guard
  assert.match(rules, /email_verified == true/);
  assert.match(rules, /function isValidId\(id\)/);

  // Validation helpers & temporal integrity
  assert.match(rules, /function isValidWorkspace\(data, userId\)/);
  assert.match(rules, /function isValidPrivateInfo\(data, userId\)/);
  assert.match(rules, /function isValidTrade\(data, userId, tradeId\)/);
  assert.match(rules, /function isValidCopilotLog\(data, userId, logId\)/);
  assert.match(rules, /request\.time/);

  // Terminal locking on CLOSED trades + affectedKeys allowlist
  assert.match(rules, /existing\(\)\.status == 'OPEN'/);
  assert.match(rules, /incoming\(\)\.status == 'CLOSED'/);
  assert.match(rules, /affectedKeys\(\)\.hasOnly\(/);

  // Blueprint paths synchronized
  for (const collectionPath of Object.keys(blueprint.firestore)) {
    assert.ok(collectionPath.startsWith('/users/'), `Expected scoped path: ${collectionPath}`);
  }
});
