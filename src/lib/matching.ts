import { BuiltInPowerupCodes, PluginRem, RNPlugin, RichTextInterface } from '@remnote/plugin-sdk';
import { MATCHING_POWERUP, MIN_PAIRS } from './consts';
import { makeSorting } from './sorting';

/**
 * A Matching card is an ordinary rem tree, so it stays readable and editable
 * in the editor:
 *
 *   Prompt → ⇄                  ← Matching powerup + forward card: ONE card, one schedule
 *     Left 1 :: Right 1         ← practice direction "none"
 *     Left 2 :: Right 2
 *
 * The queue widget (widgets/matching_queue.tsx) draws the exercise over that
 * card. The back side is only a marker that gives the prompt its single card.
 *
 * Not a Multi-Line card (the first version, 2026-10-21): RemNote grades a
 * Multi-Line card line by line in its own answer view, which the widget
 * covers, and until each line is marked it offers only "Forgot".
 */
export const MATCHING_BACK = '⇄';

export interface Pair {
  remId: string;
  left: RichTextInterface;
  right: RichTextInterface;
}

const hasText = (rt: RichTextInterface | undefined) =>
  !!rt?.some((el) => (typeof el === 'string' ? el.trim() : (el as any).i !== 'm' || (el as any).text?.trim()));

/** The pairs of a Matching card: its children that have a back side, in order. */
export async function readPairs(rem: PluginRem): Promise<Pair[]> {
  const pairs: Pair[] = [];
  for (const child of await rem.getChildrenRem()) {
    if (!hasText(child.text) || !hasText(child.backText)) continue;
    if (await child.hasPowerup(BuiltInPowerupCodes.ExtraCardDetail)) continue;
    pairs.push({ remId: child._id, left: child.text!, right: child.backText! });
  }
  return pairs;
}

export const isMatching = (rem: PluginRem) => rem.hasPowerup(MATCHING_POWERUP);

/**
 * Turns a rem whose children are `left :: right` rems into one Matching card.
 * The children's own cards are switched off (direction "none"); their review
 * history stays with them should the conversion be undone.
 */
export async function makeMatching(rem: PluginRem): Promise<number> {
  const pairs = await readPairs(rem);
  if (pairs.length < MIN_PAIRS) {
    throw new Error(`a Matching card needs at least ${MIN_PAIRS} children written as "left :: right" (found ${pairs.length})`);
  }
  if (hasText(rem.backText) && !isMarker(rem.backText)) {
    throw new Error('the prompt has a back side of its own; remove it first');
  }
  const isPair = new Set(pairs.map((p) => p.remId));
  for (const child of await rem.getChildrenRem()) {
    if (!isPair.has(child._id)) continue;
    await child.setPracticeDirection('none');
    // Card Items of the first (Multi-Line) version are plain children again.
    await child.setIsCardItem(false);
  }
  await rem.removePowerup(BuiltInPowerupCodes.MultiLineCard);
  await rem.setBackText([MATCHING_BACK]);
  await rem.setPracticeDirection('forward');
  await rem.addPowerup(MATCHING_POWERUP);
  return pairs.length;
}

const isMarker = (rt: RichTextInterface | undefined) =>
  !!rt && rt.map((el) => (typeof el === 'string' ? el : (el as any).text ?? '')).join('').trim() === MATCHING_BACK;

/**
 * Brings Matching cards made as Multi-Line cards (the first version) to the
 * current form. Run at startup; a card already current is left alone.
 */
export async function migrateMatchingCards(plugin: RNPlugin): Promise<number> {
  const powerup = await plugin.powerup.getPowerupByCode(MATCHING_POWERUP);
  let migrated = 0;
  for (const rem of (await powerup?.taggedRem()) ?? []) {
    if (!(await rem.hasPowerup(BuiltInPowerupCodes.MultiLineCard))) continue;
    try {
      await makeMatching(rem);
      migrated++;
    } catch (e) {
      console.warn('[Matching Cards] could not migrate', rem._id, e);
    }
  }
  return migrated;
}

/** Undoes makeMatching: each pair is a forward card again, and the prompt loses its marker card. */
export async function separateMatching(rem: PluginRem): Promise<number> {
  const pairs = await readPairs(rem);
  for (const child of await rem.getChildrenRem()) {
    if (!pairs.some((p) => p.remId === child._id)) continue;
    await child.setIsCardItem(false);
    await child.setPracticeDirection('forward');
  }
  await rem.removePowerup(MATCHING_POWERUP);
  await rem.removePowerup(BuiltInPowerupCodes.MultiLineCard);
  if (isMarker(rem.backText)) await rem.setBackText(undefined);
  return pairs.length;
}

async function createRem(plugin: RNPlugin, parent: PluginRem, position: number, text: RichTextInterface) {
  const rem = await plugin.rem.createRem();
  if (!rem) throw new Error('RemNote did not create the rem');
  await rem.setText(text);
  await rem.setParent(parent, position);
  return rem;
}

export type ExerciseKind = 'matching' | 'sorting';

export interface CreateRequest {
  kind: ExerciseKind;
  parentId: string;
  /** Position among the parent's children; at the end when left out. */
  position?: number;
  prompt: RichTextInterface;
  /** Matching: left :: right. Sorting: item :: its pile. */
  pairs: { left: RichTextInterface; right: RichTextInterface }[];
}

/** Builds a Matching card or a sorting exercise from data (the bridge's `create`). All or nothing. */
export async function createExercise(plugin: RNPlugin, request: CreateRequest): Promise<PluginRem> {
  const parent = await plugin.rem.findOne(request.parentId);
  if (!parent) throw new Error('parent rem not found');
  const pairs = request.pairs.filter((p) => hasText(p.left) && hasText(p.right));
  if (pairs.length < MIN_PAIRS) throw new Error(`at least ${MIN_PAIRS} pairs with both sides are needed`);
  const position = request.position ?? (await parent.getChildrenRem()).length;
  const rem = await createRem(plugin, parent, position, request.prompt);
  try {
    for (const [i, pair] of pairs.entries()) {
      const child = await createRem(plugin, rem, i, pair.left);
      await child.setBackText(pair.right);
      await child.setPracticeDirection('forward');
    }
    await makeExercise(rem, request.kind);
  } catch (e) {
    await rem.remove().catch(() => undefined);
    throw e;
  }
  return rem;
}

/** Turns an existing rem with `left :: right` children into an exercise of that kind. */
export async function makeExercise(rem: PluginRem, kind: ExerciseKind): Promise<number> {
  if (kind === 'sorting') return (await makeSorting(rem)).items;
  return makeMatching(rem);
}
