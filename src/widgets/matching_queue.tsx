import { renderWidget, usePlugin } from '@remnote/plugin-sdk';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import '../style.css';
import { ExerciseHeader } from '../components/ExerciseHeader';
import { MATCHING_WIDGET } from '../lib/consts';
import { useCurrentCard } from '../lib/current_card';
import { useReportHeight } from '../lib/frame_height';
import { Board, boardLinks, Grade, grade, newBoard, place, shuffle, suggest } from '../lib/grading';
import { readPairs } from '../lib/matching';
import { t } from '../lib/i18n';

/**
 * Drawn on the card of every rem with the Matching powerup, as Articulate
 * Rise draws its matching exercise: the right column stays put, one row each;
 * the left items are puzzle pieces to drag onto a row, where they snap to the
 * right piece (swapping with the item that was there). Pointer events, so
 * mouse, pen and touch alike; tapping a piece and then a row does the same.
 *
 * "Check" grades the connected rows and reveals the answer, so RemNote's own
 * rating buttons appear; the widget names the rating it suggests. The exercise
 * is one card, so that rating schedules the whole exercise.
 */

interface ViewPair {
  id: string;
  leftHtml: string;
  rightHtml: string;
  rightText: string;
}

interface Drag {
  from: number;
  dx: number;
  dy: number;
  over: number | null;
}

function MatchingExercise({ remId, cardId, revealed }: { remId: string; cardId?: string; revealed: boolean }) {
  const plugin = usePlugin();
  const [pairs, setPairs] = useState<ViewPair[] | null>(null);
  const [board, setBoard] = useState<Board | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [result, setResult] = useState<Grade | null>(null);
  const start = useRef<{ x: number; y: number; moved: boolean } | null>(null);

  // A new order every day, stable while the card is on screen; the two columns shuffled apart.
  const seed = `${cardId ?? remId}:${new Date().toDateString()}`;

  useEffect(() => {
    (async () => {
      const rem = await plugin.rem.findOne(remId);
      if (!rem) return;
      const view: ViewPair[] = [];
      for (const p of await readPairs(rem)) {
        view.push({
          id: p.remId,
          leftHtml: await plugin.richText.toHTML(p.left),
          rightHtml: await plugin.richText.toHTML(p.right),
          rightText: await plugin.richText.toString(p.right),
        });
      }
      setPairs(view);
      setBoard(newBoard(shuffle(view.map((p) => p.id), `${seed}:left`)));
    })();
  }, [remId]);

  const rightOrder = useMemo(() => (pairs ? shuffle(pairs.map((p) => p.id), `${seed}:right`) : []), [pairs]);

  // Revealed by RemNote (space bar, its button) without "Check": grade what is connected, so the answer shows.
  useEffect(() => {
    if (revealed && !result && pairs && board) setResult(grade(pairs, boardLinks(board, rightOrder)));
  }, [revealed, pairs, board]);

  if (!pairs || !board) return null;
  if (pairs.length < 2) return <div className="matching muted">{t('tooFew')}</div>;

  const byId = new Map(pairs.map((p) => [p.id, p]));
  const done = !!result;
  const connectedCount = board.connected.filter(Boolean).length;

  const drop = (from: number, to: number) => {
    setBoard(place(board, from, to));
    setSelected(null);
  };

  // The row a drop would go to. Every element under the pointer, minus the
  // dragged piece (the topmost one, still inside the row it came from). A right
  // piece targets its row, the piece's own row included (connect in place);
  // anywhere else in a row targets it only if it is another row, so the drag
  // does not light up its own row the moment it starts.
  const rowAt = (x: number, y: number, dragged: Element, from: number): number | null => {
    const under = document.elementsFromPoint(x, y).filter((e) => !dragged.contains(e));
    const rowOf = (e: Element | null | undefined) => {
      const el = e?.closest('[data-row]') as HTMLElement | null | undefined;
      return el ? Number(el.dataset.row) : null;
    };
    const right = under.find((e) => e.closest('.piece.right'));
    if (right) return rowOf(right);
    const row = rowOf(under.find((e) => e.closest('[data-row]')));
    return row !== from ? row : null;
  };

  const onPointerDown = (row: number) => (e: React.PointerEvent<HTMLDivElement>) => {
    if (done) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    start.current = { x: e.clientX, y: e.clientY, moved: false };
    setDrag({ from: row, dx: 0, dy: 0, over: null });
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!start.current || !drag) return;
    const dx = e.clientX - start.current.x;
    const dy = e.clientY - start.current.y;
    if (Math.abs(dx) + Math.abs(dy) > 6) start.current.moved = true;
    setDrag({ ...drag, dx, dy, over: rowAt(e.clientX, e.clientY, e.currentTarget, drag.from) });
  };
  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!start.current || !drag) return;
    const moved = start.current.moved;
    const over = rowAt(e.clientX, e.clientY, e.currentTarget, drag.from);
    start.current = null;
    setDrag(null);
    if (!moved) {
      // A tap: pick the piece up, or drop the one already picked here.
      if (selected === null) setSelected(drag.from);
      else drop(selected, drag.from);
      return;
    }
    if (over !== null) drop(drag.from, over);
  };
  const tapRow = (row: number) => {
    if (done || selected === null) return;
    drop(selected, row);
  };

  const check = async () => {
    setResult(grade(pairs, boardLinks(board, rightOrder)));
    setSelected(null);
    await plugin.queue.showAnswer();
  };

  const rowState = (row: number) => {
    if (!result) return '';
    const leftId = board.order[row];
    return result.correct.includes(leftId) ? 'ok' : result.wrong.includes(leftId) ? 'ko' : 'missing';
  };
  const suggestion = result ? suggest(result) : null;
  // The left item that belongs beside a row's right side (same right text counts).
  const rightKey = (id: string) => byId.get(id)!.rightText.replace(/\s+/g, ' ').trim().toLowerCase();
  const belongsTo = (row: number) => pairs.find((p) => rightKey(p.id) === rightKey(rightOrder[row]))!;

  return (
    <div className="matching">
      <ExerciseHeader remId={remId} />
      <div className="board">
        {rightOrder.map((rightId, row) => {
          const leftId = board.order[row];
          const connected = board.connected[row];
          const dragging = drag?.from === row && start.current?.moved;
          const st = rowState(row);
          return (
            <div key={rightId} className={`row ${connected ? 'connected' : ''} ${st}`} data-row={row}>
              <div
                className={`piece left ${selected === row ? 'selected' : ''} ${dragging ? 'dragging' : ''}`}
                style={dragging ? { transform: `translate(${drag!.dx}px, ${drag!.dy}px)` } : undefined}
                onPointerDown={onPointerDown(row)}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={() => {
                  start.current = null;
                  setDrag(null);
                }}
              >
                <span className="grip">⋮⋮</span>
                {st === 'ok' && <span className="mark">✔</span>}
                {(st === 'ko' || st === 'missing') && <span className="mark">✘</span>}
                <span className="content" dangerouslySetInnerHTML={{ __html: byId.get(leftId)!.leftHtml }} />
              </div>
              <div className={`piece right ${drag?.over === row ? 'target' : ''}`} onClick={() => tapRow(row)}>
                <span className="content" dangerouslySetInnerHTML={{ __html: byId.get(rightId)!.rightHtml }} />
              </div>
              {done && st !== 'ok' && (
                <div className="answer">
                  ✔ <span dangerouslySetInnerHTML={{ __html: belongsTo(row).leftHtml }} />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {!done ? (
        <div className="bar">
          <span className="muted">
            {t('linked', connectedCount, pairs.length)} · {t('howTo')}
          </span>
          <span className="spacer" />
          <button className="primary" disabled={!connectedCount} onClick={check}>
            {t('check')}
          </button>
        </div>
      ) : (
        <div className="bar">
          <span>
            <b>{t('score', result!.correct.length, pairs.length)}</b>
          </span>
          <span className="spacer" />
          <span className="suggestion">
            {t('suggested')}: <b>{t(suggestion!)}</b>
          </span>
        </div>
      )}
    </div>
  );
}

function MatchingQueue() {
  const card = useCurrentCard();
  const root = useRef<HTMLDivElement>(null);
  useReportHeight(root, MATCHING_WIDGET);
  return (
    <div ref={root}>
      {/* A fresh exercise (board and all) for every card the queue shows. */}
      {card && (
        <MatchingExercise key={card.cardId ?? card.remId} remId={card.remId} cardId={card.cardId} revealed={card.revealed} />
      )}
    </div>
  );
}

renderWidget(MatchingQueue);
