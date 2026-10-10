import test from 'node:test';
import assert from 'node:assert/strict';
import { search, normalize, formatResult } from './search.js';

test('normalizes Arabic variants and diacritics', () => {
  assert.equal(normalize('إِلٰه'), normalize('اله'));
  assert.equal(normalize('  WATER  '), 'water');
});
test('finds dictionary entries in Coptic, English, and Arabic', () => {
  assert.ok(search('ⲁ').length > 0);
  assert.ok(search('water').length > 0);
  assert.ok(search('ماء').length > 0);
});
test('result messages contain the headword and meaning', () => {
  const row = search('water')[0];
  assert.ok(row);
  assert.match(formatResult(row), /المعنى:/u);
});
test('empty queries return no matches', () => assert.deepEqual(search('   '), []));
