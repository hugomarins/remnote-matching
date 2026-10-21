import type { PluginRem, RichTextInterface } from '@remnote/plugin-sdk';
import { CARD_CLUSTER_POWERUP, MIN_PILES, SORTING_ITEM_POWERUP, SORTING_POWERUP } from './consts';
import { readPairs } from './matching';

/**
 * A sorting exercise keeps one card per item, each scheduled on its own:
 *
 *   Sort: Peso · Volume · Especializados     ← Sorting + Card Cluster (its items come up together)
 *     Carga geral → Peso                     ← forward card, Sorting Item
 *     Ro-Ro → Volume
 *
 * The piles are the items' back sides, in the order they first appear. The
 * queue widget (widgets/sorting_queue.tsx) draws an item's card as the item to
 * drag onto one of those piles. Without the plugin, each card is a plain
 * forward card.
 */

export interface SortingView {
  item: RichTextInterface;
  /** Index into `piles` of the item's own pile. */
  answer: number;
  piles: RichTextInterface[];
}

const key = (rt: RichTextInterface) =>
  rt
    .map((el) => (typeof el === 'string' ? el : (el as any).text ?? ''))
    .join('')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

/** The distinct back sides of the items, in order of first appearance. */
export function pilesOf(backs: RichTextInterface[]): RichTextInterface[] {
  const seen = new Map<string, RichTextInterface>();
  for (const back of backs) if (!seen.has(key(back))) seen.set(key(back), back);
  return [...seen.values()];
}

/** What the queue widget draws for one item's card. */
export async function readSortingItem(item: PluginRem): Promise<SortingView | null> {
  const parent = await item.getParentRem();
  if (!parent || !item.backText) return null;
  const piles = pilesOf((await readPairs(parent)).map((p) => p.right));
  const answer = piles.findIndex((p) => key(p) === key(item.backText!));
  return answer < 0 ? null : { item: item.text ?? [], answer, piles };
}

export async function makeSorting(rem: PluginRem): Promise<{ items: number; piles: number }> {
  const pairs = await readPairs(rem);
  const piles = pilesOf(pairs.map((p) => p.right)).length;
  if (piles < MIN_PILES) {
    throw new Error(`a sorting exercise needs children written as "item :: pile" with at least ${MIN_PILES} piles (found ${piles})`);
  }
  const isItem = new Set(pairs.map((p) => p.remId));
  for (const child of await rem.getChildrenRem()) {
    if (!isItem.has(child._id)) continue;
    await child.addPowerup(SORTING_ITEM_POWERUP);
    if ((await child.getPracticeDirection()) === 'none') await child.setPracticeDirection('forward');
  }
  await rem.addPowerup(SORTING_POWERUP);
  await rem.addPowerup(CARD_CLUSTER_POWERUP);
  return { items: pairs.length, piles };
}

export async function separateSorting(rem: PluginRem): Promise<number> {
  let n = 0;
  for (const child of await rem.getChildrenRem()) {
    if (!(await child.hasPowerup(SORTING_ITEM_POWERUP))) continue;
    await child.removePowerup(SORTING_ITEM_POWERUP);
    n++;
  }
  await rem.removePowerup(SORTING_POWERUP);
  await rem.removePowerup(CARD_CLUSTER_POWERUP);
  return n;
}
