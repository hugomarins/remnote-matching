import assert from 'assert';
import { grade, shuffle, suggest } from './grading';

const pairs = [
  { id: 'a', rightText: 'determinam a dificuldade de dragagem' },
  { id: 'b', rightText: 'causam movimentos no navio' },
  { id: 'c', rightText: 'afetam o calado' },
  { id: 'd', rightText: 'Afetam  o calado' }, // same answer as c, other spacing and case
];

// All right, with c and d crossed over (same right side): still right.
let g = grade(pairs, { a: 'a', b: 'b', c: 'd', d: 'c' });
assert.deepStrictEqual(g, { correct: ['a', 'b', 'c', 'd'], wrong: [], missing: [] });
assert.strictEqual(suggest(g), 'good');

// One swap: two wrong.
g = grade(pairs, { a: 'b', b: 'a', c: 'c', d: 'd' });
assert.deepStrictEqual(g.wrong, ['a', 'b']);
assert.strictEqual(suggest(g), 'again');

// One left unlinked out of four: hard.
g = grade(pairs, { a: 'a', b: 'b', c: 'c' });
assert.deepStrictEqual(g.missing, ['d']);
assert.strictEqual(suggest(g), 'hard');

// One mistake in three pairs is a third of them: again.
assert.strictEqual(suggest(grade(pairs.slice(0, 3), { a: 'a', b: 'b' })), 'again');

// The shuffle is deterministic, keeps every item and never returns the key's order.
const items = ['a', 'b', 'c', 'd', 'e'];
assert.deepStrictEqual(shuffle(items, 'card1'), shuffle(items, 'card1'));
assert.deepStrictEqual([...shuffle(items, 'card1')].sort(), items);
for (const seed of ['x', 'y', 'z', 'card1', 'card2', '']) assert.notDeepStrictEqual(shuffle(items, seed), items);
assert.deepStrictEqual(shuffle(['a'], 's'), ['a']);

console.log('grading.test.ts: ok');
