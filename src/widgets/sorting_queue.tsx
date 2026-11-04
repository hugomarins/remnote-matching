import { AppEvents, QueueInteractionScore, renderWidget, usePlugin } from '@remnote/plugin-sdk';
import React, { useEffect, useRef, useState } from 'react';
import '../style.css';
import { ExerciseHeader } from '../components/ExerciseHeader';
import { PLUGIN_ID, SORTING_WIDGET } from '../lib/consts';
import { useCurrentCard } from '../lib/current_card';
import { useReportHeight } from '../lib/frame_height';
import { t } from '../lib/i18n';
import { readSortingItem } from '../lib/sorting';
import { useSuggestedScore } from '../lib/suggestion';

/**
 * Drawn on the card of every item of a sorting exercise, Rise style: the item
 * in a card at the top, the piles as boxes below. Drag the item onto a pile
 * (pointer events: mouse, pen and touch alike), tap a pile or press its
 * number (1 for the first, see useNumberKeys). That reveals
 * the answer, so RemNote's own rating buttons appear, the suggested one (Good
 * if right, Again if not) highlighted and applied by Enter (lib/suggestion.ts).
 * Each item keeps its own schedule.
 */

interface View {
  /** The exercise rem ("Classifique: …"), the item's parent. */
  exerciseId: string;
  itemHtml: string;
  pileHtml: string[];
  answer: number;
}

/** Number keys choose a pile: 1 the first, … 9 the ninth. */
const MAX_KEYED_PILES = 9;

/**
 * Until the item is answered, the keys 1…n (n piles) choose a pile.
 *
 * Before the reveal the keyboard is usually RemNote's (its queue element has
 * the focus), and there any key reveals the answer. app.stealKeys keeps those
 * keys from it (read in the 1.29 bundle, 2026-11-04): GlobalStealKeySingleton
 * listens to keydown on the host document in the capture phase, and for a
 * stolen key calls preventDefault and stopPropagation and emits StealKeyEvent
 * with the plugin id as the listener key and `{ key }` as data. The keys are
 * stolen app-wide, so they are released as soon as the item is answered (then
 * 1–4 are RemNote's rating keys again) or the widget goes away.
 *
 * The numeric keypad can't be stolen: the host matches stolen keys with
 * is-hotkey by keyCode, "1" is 49 (the top row), the keypad's 1 is 97, and no
 * hotkey string yields 97. So, as lib/suggestion.ts does after the reveal,
 * the frame takes the focus while the item waits for an answer: its own keys
 * never reach the host, and a keydown listener here reads both rows by
 * KeyboardEvent.code (Digit1 / Numpad1). Enter and Space, RemNote's keys for
 * Reveal Answer, still reveal without a choice; other keys do nothing.
 */
function useNumberKeys(piles: number, active: boolean, choose: (pile: number) => void) {
  const plugin = usePlugin();
  const chooseRef = useRef(choose);
  chooseRef.current = choose;

  useEffect(() => {
    if (!active || piles < 1) return;
    const keys = Array.from({ length: Math.min(piles, MAX_KEYED_PILES) }, (_, i) => String(i + 1));
    const pick = (key: unknown) => {
      const i = keys.indexOf(String(key));
      if (i < 0) return false;
      chooseRef.current(i);
      return true;
    };

    void plugin.app.stealKeys(keys).catch(() => {});
    const onSteal = (e: any) => void pick(e?.key);
    plugin.event.addListener(AppEvents.StealKeyEvent, PLUGIN_ID, onSteal);
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return;
      const digit = /^(?:Digit|Numpad)([1-9])$/.exec(e.code)?.[1] ?? e.key;
      if (pick(digit)) {
        e.preventDefault();
      } else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        void plugin.queue.showAnswer();
      }
    };
    window.addEventListener('keydown', onKey);
    // RemNote focuses its queue element when it loads the card; take the focus after it.
    const refocus = [80, 400].map((ms) => setTimeout(() => window.focus(), ms));

    return () => {
      refocus.forEach(clearTimeout);
      window.removeEventListener('keydown', onKey);
      plugin.event.removeListener(AppEvents.StealKeyEvent, PLUGIN_ID, onSteal);
      void plugin.app.releaseKeys(keys).catch(() => {});
    };
  }, [piles, active]);
}

function SortingItem({ remId, revealed }: { remId: string; revealed: boolean }) {
  const plugin = usePlugin();
  const [view, setView] = useState<View | null>(null);
  const [chosen, setChosen] = useState<number | null>(null);
  const [drag, setDrag] = useState<{ dx: number; dy: number; over: number | null } | null>(null);
  const start = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    (async () => {
      const rem = await plugin.rem.findOne(remId);
      const v = rem && (await readSortingItem(rem));
      if (!v || !rem.parent) return;
      setView({
        exerciseId: rem.parent,
        itemHtml: await plugin.richText.toHTML(v.item),
        pileHtml: await Promise.all(v.piles.map((p) => plugin.richText.toHTML(p))),
        answer: v.answer,
      });
    })();
  }, [remId]);

  // Right: Good; wrong: Again. Nothing when RemNote revealed it before an answer.
  useSuggestedScore(
    view && chosen !== null ? (chosen === view.answer ? QueueInteractionScore.GOOD : QueueInteractionScore.AGAIN) : undefined
  );

  const done = chosen !== null || revealed;

  const answer = async (pile: number) => {
    if (done) return;
    setChosen(pile);
    await plugin.queue.showAnswer();
  };

  useNumberKeys(view?.pileHtml.length ?? 0, !!view && !done, (pile) => void answer(pile));

  if (!view) return null;

  // Every element under the pointer: the dragged card itself is the topmost one.
  const pileAt = (x: number, y: number): number | null => {
    const el = document
      .elementsFromPoint(x, y)
      .map((e) => e.closest('[data-pile]') as HTMLElement | null)
      .find((e) => !!e);
    return el ? Number(el.dataset.pile) : null;
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (done) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    start.current = { x: e.clientX, y: e.clientY };
    setDrag({ dx: 0, dy: 0, over: null });
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!start.current) return;
    setDrag({ dx: e.clientX - start.current.x, dy: e.clientY - start.current.y, over: pileAt(e.clientX, e.clientY) });
  };
  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!start.current) return;
    const over = pileAt(e.clientX, e.clientY);
    start.current = null;
    setDrag(null);
    if (over !== null) void answer(over);
  };

  const right = chosen === view.answer;

  return (
    <div className="matching sorting">
      <ExerciseHeader remId={view.exerciseId} />
      <div className="stage">
        <div
          className={`item ${drag ? 'dragging' : ''} ${done ? (chosen === null ? 'revealed' : right ? 'ok' : 'ko') : ''}`}
          style={drag ? { transform: `translate(${drag.dx}px, ${drag.dy}px)` } : undefined}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={() => {
            start.current = null;
            setDrag(null);
          }}
        >
          <span dangerouslySetInnerHTML={{ __html: view.itemHtml }} />
          {!done && <span className="grip">═</span>}
        </div>
      </div>

      <div className="piles" style={{ gridTemplateColumns: `repeat(${Math.min(view.pileHtml.length, 4)}, 1fr)` }}>
        {view.pileHtml.map((html, i) => {
          const state = !done ? (drag?.over === i ? 'over' : '') : i === view.answer ? 'ok' : i === chosen ? 'ko' : 'dim';
          return (
            <button key={i} data-pile={i} className={`pile ${state}`} onClick={() => answer(i)}>
              {!done && i < MAX_KEYED_PILES && <kbd className="pile-key">{i + 1}</kbd>}
              <span dangerouslySetInnerHTML={{ __html: html }} />
            </button>
          );
        })}
      </div>

      <div className="bar">
        {!done ? (
          <span className="muted">{t('dragHint')}</span>
        ) : chosen === null ? null : (
          <>
            <b>{right ? t('right') : t('wrong')}</b>
            <span className="spacer" />
            <span className="suggestion">
              {t('suggested')}: <b>{t(right ? 'good' : 'again')}</b> · {t('enterHint')}
            </span>
          </>
        )}
      </div>
    </div>
  );
}

function SortingQueue() {
  const card = useCurrentCard();
  const root = useRef<HTMLDivElement>(null);
  useReportHeight(root, SORTING_WIDGET);
  return (
    <div ref={root}>
      {/* A fresh item (state and all) for every card the queue shows. */}
      {card && <SortingItem key={card.cardId ?? card.remId} remId={card.remId} revealed={card.revealed} />}
    </div>
  );
}

renderWidget(SortingQueue);
