import { SORTING_ITEM_NAME } from './consts';

/**
 * Hides the "Sorting Item" tag on every item of a sorting exercise: the
 * exercise rem already shows "Sorting". RemNote writes a powerup's tags into
 * data-rem-tags as the slug of its NAME (as Incremental RemNote's True/False
 * cards rely on); both spellings of the slug are covered.
 *
 * No queue layout rules here. A first version copied Incremental RemNote's
 * "grow chain" (every wrapper up to the queue grows, so its reader fills the
 * card). On a flashcard that made the card exactly as tall as the queue, and
 * once the answer was revealed the AI insight panel's spacer overflowed it:
 * the scrollbar came and went, the panel re-measured, and the Explanation
 * flickered without end (seen 2026-10-21). The frame is now sized to its
 * content by lib/frame_height.ts, and RemNote lays the card out as any other.
 */
const itemSlugs = [SORTING_ITEM_NAME.toLowerCase().replace(/\s+/g, '-'), SORTING_ITEM_NAME.toLowerCase().replace(/\s+/g, '')];

export const CSS_ID = 'matching-cards';
export const CSS = itemSlugs
  .map((slug) => `.rn-editor__rem__body[data-rem-tags~="${slug}"] .hierarchy-editor__tag-bar__tag { display: none; }`)
  .join('\n');
