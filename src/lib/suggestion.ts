import { QueueInteractionScore, RNPlugin, usePlugin } from '@remnote/plugin-sdk';
import { useEffect } from 'react';

/**
 * The suggested rating, as RemNote shows it for a Type in Answer card: the
 * answer button with a coloured border and an "↵ Enter" tab, applied by Enter.
 *
 * RemNote's own suggestion cannot be set by a plugin (read from the 1.28
 * bundle, 2026-10-21): the buttons get `highlightScore = voiceGrade ??
 * suggestedAnswerButton()`, and suggestedAnswerButton() reads
 * revealedAnswerRight/Wrong, which only its type-in-answer comparison (and its
 * AI tutor) set; the SDK has no setter and the host's queue.showAnswer takes no
 * argument. So:
 *
 * - the widget publishes its suggestion in session storage, and the index
 *   widget (the one whose registerCSS applies) draws RemNote's highlight on
 *   that button, which carries data-test="accuracy-button-<score>";
 * - Enter (and 1–4, RemNote's rating keys) are handled inside the widget, which
 *   has the keyboard focus, through queue.rateCurrentCard(). The host runs it
 *   as answerCard(score) on the queue component that shows the card on screen,
 *   the very call of the answer buttons, so it rates the right card even
 *   inside a Card Cluster (unlike queue.getCurrentCard(), pinned to the anchor).
 */

const PLUGIN_ID = 'matching-cards';
const KEY = 'matching-cards.suggested-score';

/** RemNote's rating keys: 1 Forgot, 2 Hard, 3 Easy (Good), 4 Instant (Easy). */
const KEY_SCORES: Record<string, QueueInteractionScore> = {
  '1': QueueInteractionScore.AGAIN,
  '2': QueueInteractionScore.HARD,
  '3': QueueInteractionScore.GOOD,
  '4': QueueInteractionScore.EASY,
};

/**
 * In a queue widget: publishes `score` (undefined until the exercise is graded)
 * and, once graded, rates with Enter / 1–4. Clears the suggestion when the
 * card goes away.
 */
export function useSuggestedScore(score: QueueInteractionScore | undefined) {
  const plugin = usePlugin();

  useEffect(() => {
    void plugin.storage.setSession(KEY, score ?? null);
  }, [score]);
  useEffect(() => () => void plugin.storage.setSession(KEY, null), []);

  useEffect(() => {
    if (score === undefined) return;
    // RemNote's reveal moves the focus to its own queue element; take it back so the keys reach us.
    const refocus = setTimeout(() => window.focus(), 80);
    let rated = false;
    const onKey = (e: KeyboardEvent) => {
      if (rated || e.repeat || e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return;
      const chosen = e.key === 'Enter' ? score : KEY_SCORES[e.key];
      if (chosen === undefined) return;
      e.preventDefault();
      rated = true;
      void plugin.queue.rateCurrentCard(chosen);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      clearTimeout(refocus);
      window.removeEventListener('keydown', onKey);
    };
  }, [score]);
}

const COLORS: Partial<Record<number, string>> = {
  [QueueInteractionScore.AGAIN]: '#dc2626',
  [QueueInteractionScore.HARD]: '#d97706',
  [QueueInteractionScore.GOOD]: '#16a34a',
  [QueueInteractionScore.EASY]: '#2563eb',
};

const highlightCss = (score: number) => {
  const color = COLORS[score] ?? '#16a34a';
  const button = `.rn-queue:has(iframe[data-plugin-id="${PLUGIN_ID}"]) button[data-test="accuracy-button-${score}"]`;
  return `
${button} {
  border-color: ${color} !important;
  border-top-color: transparent !important;
  border-top-left-radius: 0 !important;
  border-top-right-radius: 0 !important;
  overflow: visible !important;
}
${button}::before {
  content: "↵ Enter";
  position: absolute;
  top: -25px;
  left: -1px;
  right: -1px;
  height: 25px;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid ${color};
  border-bottom: none;
  border-radius: 8px 8px 0 0;
  background: inherit;
  color: inherit;
  font-size: 12px;
  font-weight: 500;
  pointer-events: none;
}`;
};

/** In the index widget: draws the published suggestion on RemNote's answer button. */
export function registerSuggestionHighlight(plugin: RNPlugin) {
  plugin.track(async (rp) => {
    const score = await rp.storage.getSession<number | null>(KEY);
    await plugin.app.registerCSS(`${PLUGIN_ID}-suggestion`, typeof score === 'number' ? highlightCss(score) : '');
  });
}
