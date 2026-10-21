import { AppEvents, QueueInteractionScore, renderWidget, usePlugin, WidgetLocation } from '@remnote/plugin-sdk';
import React, { useEffect, useRef, useState } from 'react';
import '../style.css';
import { t } from '../lib/i18n';
import { readSortingItem } from '../lib/sorting';

/**
 * Drawn on the card of every item of a sorting exercise, Rise style: the item
 * in a card at the top, the piles as boxes below. Drag the item onto a pile
 * (pointer events: mouse, pen and touch alike) or tap a pile. The answer is
 * revealed and a rating suggested (Good if right, Again if not); each item
 * keeps its own schedule.
 */

interface View {
  itemHtml: string;
  pileHtml: string[];
  answer: number;
}

const SCORES = [
  { key: 'again', score: QueueInteractionScore.AGAIN },
  { key: 'hard', score: QueueInteractionScore.HARD },
  { key: 'good', score: QueueInteractionScore.GOOD },
  { key: 'easy', score: QueueInteractionScore.EASY },
] as const;

function SortingQueue() {
  const plugin = usePlugin();
  const [view, setView] = useState<View | null>(null);
  const [chosen, setChosen] = useState<number | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [drag, setDrag] = useState<{ dx: number; dy: number; over: number | null } | null>(null);
  const start = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    (async () => {
      const ctx = await plugin.widget.getWidgetContext<WidgetLocation.Flashcard>();
      if (!ctx?.remId) return;
      setRevealed(!!ctx.revealed);
      const rem = await plugin.rem.findOne(ctx.remId);
      const v = rem && (await readSortingItem(rem));
      if (!v) return;
      setView({
        itemHtml: await plugin.richText.toHTML(v.item),
        pileHtml: await Promise.all(v.piles.map((p) => plugin.richText.toHTML(p))),
        answer: v.answer,
      });
    })();
  }, []);

  useEffect(() => {
    const onReveal = () => setRevealed(true);
    plugin.event.addListener(AppEvents.RevealAnswer, undefined, onReveal);
    return () => plugin.event.removeListener(AppEvents.RevealAnswer, undefined, onReveal);
  }, []);

  if (!view) return null;
  const done = chosen !== null || revealed;

  const answer = async (pile: number) => {
    if (done) return;
    setChosen(pile);
    await plugin.queue.showAnswer();
  };

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
  const suggestion = chosen === null ? null : right ? 'good' : 'again';

  return (
    <div className="matching sorting">
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
              <span dangerouslySetInnerHTML={{ __html: html }} />
            </button>
          );
        })}
      </div>

      {!done ? (
        <div className="bar">
          <span className="muted">{t('dragHint')}</span>
        </div>
      ) : (
        <div className="bar">
          {chosen !== null && <b>{right ? t('right') : t('wrong')}</b>}
          <span className="spacer" />
          {SCORES.map(({ key, score }) => (
            <button
              key={key}
              className={key === suggestion ? 'primary' : ''}
              title={key === suggestion ? t('suggested') : undefined}
              onClick={() => plugin.queue.rateCurrentCard(score)}
            >
              {t(key)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

renderWidget(SortingQueue);
