import { MATCHING_WIDGET, SORTING_ITEM_NAME, SORTING_WIDGET } from './consts';

const PLUGIN_ID = 'matching-cards';

/**
 * Hides the "Sorting Item" tag on every item of a sorting exercise: the
 * exercise rem already shows "Sorting". RemNote writes a powerup's tags into
 * data-rem-tags as the slug of its NAME (as Incremental RemNote's True/False
 * cards rely on); both spellings of the slug are covered.
 */
const itemSlugs = [SORTING_ITEM_NAME.toLowerCase().replace(/\s+/g, '-'), SORTING_ITEM_NAME.toLowerCase().replace(/\s+/g, '')];
const HIDE_ITEM_TAG = itemSlugs
  .map((slug) => `.rn-editor__rem__body[data-rem-tags~="${slug}"] .hierarchy-editor__tag-bar__tag { display: none; }`)
  .join('\n');

/**
 * The queue sizes a Flashcard widget's frame to a short default, which cut the
 * piles and pairs off (seen 2026-10-21). As Incremental RemNote does for its
 * own queue widget (incremental-everything src/register/callbacks.ts,
 * QUEUE_LAYOUT_FIX_CSS), the wrappers between the queue and our frame grow, so
 * a short exercise fills the card. A long one is handled by lib/frame_height.ts,
 * which sets the frame's min-height to the content's (the chain does not reach
 * every wrapper of an ordinary flashcard). Each rule is gated on our frame
 * being in the DOM, so other cards are untouched.
 */
function growChain(widget: string) {
  const frame = `iframe[data-plugin-id="${PLUGIN_ID}"][src*="widgetName=${widget}&"]`;
  const queue = `.rn-queue:has(${frame})`;
  const box = `.queue-beautiful-box:has(${frame})`;
  return `
${queue} {
  height: 100% !important;
}
${queue} .rn-queue__content,
${queue} .rn-queue__content .rn-flashcard,
${queue} .rn-queue__content .rn-flashcard__content,
${queue} .box-border:has(${frame}),
${queue} div.fade-in-first-load:has(${frame}),
${queue} div.fade-in-first-load:has(${frame}) > div,
${queue} ${frame} {
  flex-grow: 1 !important;
}
${box} .beautiful-queue-card-scroll-stage {
  display: flex !important;
  flex-direction: column;
  flex-grow: 1 !important;
  min-height: 0;
}
${box} .beautiful-queue-card-content {
  flex-grow: 1 !important;
  min-height: 0;
}
${box} .beautiful-queue-card-free-space {
  flex-grow: 0 !important;
}`;
}

export const CSS_ID = 'matching-cards';
export const CSS = [HIDE_ITEM_TAG, growChain(MATCHING_WIDGET), growChain(SORTING_WIDGET)].join('\n');
