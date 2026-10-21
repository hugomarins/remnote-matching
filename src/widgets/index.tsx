import { declareIndexPlugin, PluginRem, ReactRNPlugin, WidgetLocation } from '@remnote/plugin-sdk';
import '../style.css';
import { registerBridge } from '../lib/bridge';
import {
  MATCHING_POWERUP,
  MATCHING_WIDGET,
  SORTING_ITEM_NAME,
  SORTING_ITEM_POWERUP,
  SORTING_POWERUP,
  SORTING_WIDGET,
} from '../lib/consts';
import { CSS, CSS_ID } from '../lib/css';
import { makeMatching, migrateMatchingCards, separateMatching } from '../lib/matching';
import { makeSorting, separateSorting } from '../lib/sorting';

async function onActivate(plugin: ReactRNPlugin) {
  await plugin.app.registerPowerup({
    name: 'Matching',
    code: MATCHING_POWERUP,
    description: 'One card: match each child\'s left side with its right side ("left :: right").',
    options: { slots: [] },
  });
  await plugin.app.registerPowerup({
    name: 'Sorting',
    code: SORTING_POWERUP,
    description: 'Sort each child ("item :: group") into its group; one card per item, practised together.',
    options: { slots: [] },
  });
  await plugin.app.registerPowerup({
    name: SORTING_ITEM_NAME,
    code: SORTING_ITEM_POWERUP,
    description: 'An item of a Sorting exercise (set by the plugin).',
    options: { slots: [] },
  });

  await plugin.app.registerCSS(CSS_ID, CSS);

  for (const [name, powerupFilter] of [
    [MATCHING_WIDGET, MATCHING_POWERUP],
    [SORTING_WIDGET, SORTING_ITEM_POWERUP],
  ]) {
    await plugin.app.registerWidget(name, WidgetLocation.Flashcard, {
      powerupFilter,
      dimensions: { width: '100%', height: 'auto' },
    });
  }

  const onFocused = async (action: (rem: PluginRem) => Promise<string>) => {
    const rem = await plugin.focus.getFocusedRem();
    if (!rem) return void (await plugin.app.toast('Put the cursor in the rem that holds the exercise.'));
    try {
      await plugin.app.toast(await action(rem));
    } catch (e: any) {
      await plugin.app.toast(e?.message ?? String(e));
    }
  };

  await plugin.app.registerCommand({
    id: 'make-matching',
    name: 'Make Matching card',
    description: 'The focused rem becomes one Matching card; its children ("left :: right") are the pairs.',
    action: () => onFocused(async (rem) => `Matching card with ${await makeMatching(rem)} pairs.`),
  });
  await plugin.app.registerCommand({
    id: 'make-sorting',
    name: 'Make Sorting exercise',
    description: 'The focused rem becomes a Sorting exercise; its children ("item :: group") keep one card each.',
    action: () =>
      onFocused(async (rem) => {
        const { items, piles } = await makeSorting(rem);
        return `Sorting exercise: ${items} items in ${piles} groups.`;
      }),
  });
  await plugin.app.registerCommand({
    id: 'separate-exercise',
    name: 'Separate Matching/Sorting into plain cards',
    description: 'Undoes "Make Matching card" or "Make Sorting exercise" on the focused rem.',
    action: () =>
      onFocused(async (rem) => {
        if (await rem.hasPowerup(MATCHING_POWERUP)) return `${await separateMatching(rem)} pairs are forward cards again.`;
        if (await rem.hasPowerup(SORTING_POWERUP)) return `${await separateSorting(rem)} items are plain cards again.`;
        return 'The focused rem is neither a Matching card nor a Sorting exercise.';
      }),
  });

  registerBridge(plugin);

  // Matching cards made as Multi-Line cards (first version) become forward cards.
  void migrateMatchingCards(plugin).then(
    (n) => n && console.log(`[Matching Cards] ${n} Matching card(s) migrated from Multi-Line`),
    (e) => console.warn('[Matching Cards] migration failed', e)
  );
}

async function onDeactivate(_: ReactRNPlugin) {}

declareIndexPlugin(onActivate, onDeactivate);
