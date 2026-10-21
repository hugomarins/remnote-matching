/** Makes a rem a Matching card (its name, "Matching", is what the tag shows). */
export const MATCHING_POWERUP = 'matchingCard';

/** Marks the rem holding a sorting exercise ("Sorting"). */
export const SORTING_POWERUP = 'sortingExercise';
/**
 * Marks each item of a sorting exercise, so the queue widget is drawn on its
 * card (a widget's powerupFilter looks at the card's own rem). Its tag is
 * hidden in the editor (lib/css.ts), which matches it by the name's slug.
 */
export const SORTING_ITEM_POWERUP = 'sortingItem';
export const SORTING_ITEM_NAME = 'Sorting Item';

/**
 * RemNote's Card Cluster, missing from the SDK's BuiltInPowerupCodes (0.0.46);
 * read from the desktop app (1.28), see incremental-everything's
 * findings/REMNOTE_POWERUP_CODES.md.
 */
export const CARD_CLUSTER_POWERUP = 'cc';

export const MATCHING_WIDGET = 'matching_queue';
export const SORTING_WIDGET = 'sorting_queue';

/** A Matching card needs at least this many pairs; a sorting exercise, this many piles. */
export const MIN_PAIRS = 2;
export const MIN_PILES = 2;
