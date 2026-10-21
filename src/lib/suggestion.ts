import { QueueInteractionScore, RNPlugin, usePlugin, WidgetLocation } from '@remnote/plugin-sdk';
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
 *
 * After a Forgot, RemNote may show the AI Explanation with "Next card" (its
 * forgot-mode screen; native type-in-answer cards skip it, since it is shown
 * only when revealedAnswerWrong is unset). That screen advances on any key,
 * but only keys RemNote receives, and the focus is still ours. So the next
 * Enter or Space after a Forgot rates Again once more, which in that screen
 * is exactly what "Next card" does (goToNextCard → answerCard(AGAIN)): with
 * the screen up, shouldShowInsightsAfterForgot() is false and the rating is
 * saved and the queue moves on. Only while the answer is still revealed and
 * the widget still shows the card it rated, so it can never rate the next one.
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
    let rated: { score: QueueInteractionScore; cardId?: string } | undefined;
    let advanced = false;
    const cardOnScreen = async () => (await plugin.widget.getWidgetContext<WidgetLocation.Flashcard>().catch(() => undefined))?.cardId;

    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return;
      if (!rated) {
        const chosen = e.key === 'Enter' ? score : KEY_SCORES[e.key];
        if (chosen === undefined) return;
        e.preventDefault();
        rated = { score: chosen };
        void (async () => {
          rated!.cardId = await cardOnScreen();
          await plugin.queue.rateCurrentCard(chosen);
        })();
        return;
      }
      // RemNote's "Next card" after a Forgot (see above).
      if (rated.score !== QueueInteractionScore.AGAIN || advanced || (e.key !== 'Enter' && e.key !== ' ')) return;
      e.preventDefault();
      advanced = true;
      void (async () => {
        const sameCard = rated!.cardId !== undefined && (await cardOnScreen()) === rated!.cardId;
        if (sameCard && (await plugin.queue.hasRevealedAnswer())) await plugin.queue.rateCurrentCard(QueueInteractionScore.AGAIN);
      })();
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
  const queue = `.rn-queue:has(iframe[data-plugin-id="${PLUGIN_ID}"])`;
  const button = `${queue} button[data-test="accuracy-button-${score}"]`;
  return `
/* Room for the tab above the row. RemNote's own highlight is what Incremental
   RemNote's card info bar watches for (.rn-queue__answer-btn.border-t-transparent
   .rounded-t-none, in its card_info_bar_dock.ts), and a plugin cannot put
   classes on RemNote's buttons. Padding the row grows RemNote's bottom
   controls, which it re-measures (--beautiful-queue-bottom-controls-height),
   and the docked bar, positioned from that, rises by the tab's height. */
${queue} .rn-queue__answer-btns:has(button[data-test="accuracy-button-${score}"]) {
  padding-top: 25px !important;
}
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
