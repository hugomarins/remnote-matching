import { RNPlugin } from '@remnote/plugin-sdk';

/**
 * What RemNote shows above a card and the widget covers: the breadcrumb of
 * the exercise rem's ancestors, and the exercise rem itself (the Matching
 * prompt, the Sorting "Classifique: …"). The same walk as Incremental
 * RemNote's reader (src/components/reader/hooks.ts): up `parent` with
 * rem.findOne, each ancestor as plain text.
 */

export interface Crumb {
  id: string;
  text: string;
}

export interface ExerciseContext {
  crumbs: Crumb[];
  titleHtml: string;
}

const MAX_DEPTH = 25;

export async function readExerciseContext(plugin: RNPlugin, remId: string): Promise<ExerciseContext | null> {
  const rem = await plugin.rem.findOne(remId);
  if (!rem) return null;
  const crumbs: Crumb[] = [];
  let parentId = rem.parent;
  for (let depth = 0; parentId && depth < MAX_DEPTH; depth++) {
    const parent = await plugin.rem.findOne(parentId);
    if (!parent) break;
    const text = parent.text ? (await plugin.richText.toString(parent.text)).trim() : '';
    crumbs.unshift({ id: parent._id, text: text || '…' });
    parentId = parent.parent;
  }
  return { crumbs, titleHtml: rem.text ? await plugin.richText.toHTML(rem.text) : '' };
}
