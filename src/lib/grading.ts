/**
 * The pure part of a matching card: shuffling the right column and grading
 * the links the learner made. No plugin calls, so it runs in the tests.
 */

export interface PairKey {
  id: string;
  /** Plain text of the right side: two pairs with the same right side accept either link. */
  rightText: string;
}

/** left pair id → the pair id whose right side the learner linked it to. */
export type Links = Record<string, string>;

export interface Grade {
  correct: string[];
  wrong: string[];
  /** Left items the learner did not link. */
  missing: string[];
}

export type Suggestion = 'again' | 'hard' | 'good';

const norm = (s: string) => s.replace(/\s+/g, ' ').trim().toLowerCase();

export function grade(pairs: PairKey[], links: Links): Grade {
  const rightOf = new Map(pairs.map((p) => [p.id, norm(p.rightText)]));
  const out: Grade = { correct: [], wrong: [], missing: [] };
  for (const p of pairs) {
    const linked = links[p.id];
    if (!linked) out.missing.push(p.id);
    else if (linked === p.id || rightOf.get(linked) === rightOf.get(p.id)) out.correct.push(p.id);
    else out.wrong.push(p.id);
  }
  return out;
}

/**
 * Good when every pair is right; Hard with one mistake in four or more pairs;
 * Again otherwise. A suggestion: the learner rates.
 */
export function suggest(g: Grade): Suggestion {
  const total = g.correct.length + g.wrong.length + g.missing.length;
  const errors = g.wrong.length + g.missing.length;
  if (!errors) return 'good';
  if (errors === 1 && total >= 4) return 'hard';
  return 'again';
}

/** A deterministic shuffle (mulberry32 on a string seed), so a re-render keeps the order. */
export function shuffle<T>(items: T[], seed: string): T[] {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let state = h >>> 0;
  const random = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  // Never hand back the answer key in order when there is another order.
  if (out.length > 1 && out.every((x, i) => x === items[i])) out.push(out.shift()!);
  return out;
}

/**
 * The Rise-style board: the right column is fixed, one row each; the left
 * items fill the rows in `order`, and `connected[r]` says whether the learner
 * joined row r's left item to its right one.
 */
export interface Board {
  order: string[];
  connected: boolean[];
}

export const newBoard = (order: string[]): Board => ({ order, connected: order.map(() => false) });

/**
 * Drops the left item of row `from` onto row `to`: the two swap, and `to` is
 * connected. The item sent back to `from` is not (it no longer sits beside the
 * right item it was joined to).
 */
export function place(board: Board, from: number, to: number): Board {
  const order = [...board.order];
  const connected = [...board.connected];
  if (from !== to) {
    [order[from], order[to]] = [order[to], order[from]];
    connected[from] = false;
  }
  connected[to] = true;
  return { order, connected };
}

/** The connected rows as links: left pair id → the pair id of the row's right side. */
export function boardLinks(board: Board, rightOrder: string[]): Links {
  const links: Links = {};
  board.order.forEach((leftId, row) => {
    if (board.connected[row]) links[leftId] = rightOrder[row];
  });
  return links;
}
