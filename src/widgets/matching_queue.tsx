import { AppEvents, QueueInteractionScore, renderWidget, usePlugin, WidgetLocation } from '@remnote/plugin-sdk';
import React, { useEffect, useMemo, useState } from 'react';
import '../style.css';
import { Grade, grade, Links, shuffle, suggest, Suggestion } from '../lib/grading';
import { readPairs } from '../lib/matching';
import { t } from '../lib/i18n';

/**
 * Drawn on the card of every rem with the Matching powerup. The learner taps
 * an item on the left, then its match on the right (taps work the same with a
 * mouse and on a phone, unlike drag and drop). "Check" grades the links,
 * reveals the answer and suggests a rating; the card is one card, so the
 * rating schedules the whole exercise.
 */

interface ViewPair {
  id: string;
  leftHtml: string;
  rightHtml: string;
  rightText: string;
}

const COLORS = ['#2563eb', '#d97706', '#7c3aed', '#059669', '#db2777', '#0891b2', '#65a30d', '#dc2626', '#4f46e5', '#ca8a04'];

const SCORES: { key: Suggestion | 'easy'; score: QueueInteractionScore }[] = [
  { key: 'again', score: QueueInteractionScore.AGAIN },
  { key: 'hard', score: QueueInteractionScore.HARD },
  { key: 'good', score: QueueInteractionScore.GOOD },
  { key: 'easy', score: QueueInteractionScore.EASY },
];

function MatchingQueue() {
  const plugin = usePlugin();
  const [ctx, setCtx] = useState<{ remId: string; cardId?: string; revealed: boolean } | null>(null);
  const [pairs, setPairs] = useState<ViewPair[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [links, setLinks] = useState<Links>({});
  const [result, setResult] = useState<Grade | null>(null);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    (async () => {
      const context = await plugin.widget.getWidgetContext<WidgetLocation.Flashcard>();
      if (!context?.remId) return;
      setCtx(context);
      setRevealed(!!context.revealed);
      const rem = await plugin.rem.findOne(context.remId);
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
    })();
  }, []);

  // RemNote's own "show answer" (space bar, the button) reveals too.
  useEffect(() => {
    const onReveal = () => setRevealed(true);
    plugin.event.addListener(AppEvents.RevealAnswer, undefined, onReveal);
    return () => plugin.event.removeListener(AppEvents.RevealAnswer, undefined, onReveal);
  }, []);

  // A new order every day, stable while the card is on screen.
  const rightOrder = useMemo(
    () => (pairs ? shuffle(pairs.map((p) => p.id), `${ctx?.cardId ?? ctx?.remId}:${new Date().toDateString()}`) : []),
    [pairs, ctx]
  );

  // Revealed without "Check": grade whatever was linked, so the answer shows.
  useEffect(() => {
    if (revealed && !result && pairs) setResult(grade(pairs, links));
  }, [revealed, pairs]);

  if (!pairs) return null;
  if (pairs.length < 2) return <div className="matching muted">{t('tooFew')}</div>;

  const byId = new Map(pairs.map((p) => [p.id, p]));
  const colorOf = (leftId: string) => COLORS[pairs.findIndex((p) => p.id === leftId) % COLORS.length];
  const leftLinkedTo = (rightId: string) => Object.keys(links).find((l) => links[l] === rightId);
  const done = !!result;

  const clickLeft = (id: string) => {
    if (done) return;
    setSelected(selected === id ? null : id);
  };
  const clickRight = (rightId: string) => {
    if (done) return;
    const holder = leftLinkedTo(rightId);
    if (!selected) {
      if (holder) {
        const next = { ...links };
        delete next[holder];
        setLinks(next);
      }
      return;
    }
    const next = { ...links };
    if (holder) delete next[holder];
    next[selected] = rightId;
    setLinks(next);
    // The next left item still free, to keep tapping.
    setSelected(pairs.find((p) => p.id !== selected && !next[p.id])?.id ?? null);
  };

  const check = async () => {
    setResult(grade(pairs, links));
    setSelected(null);
    await plugin.queue.showAnswer();
  };

  const suggestion = result ? suggest(result) : null;
  const status = (leftId: string) =>
    !result ? '' : result.correct.includes(leftId) ? 'ok' : result.wrong.includes(leftId) ? 'ko' : 'missing';

  return (
    <div className="matching">
      <div className="grid">
        <div className="column">
          {pairs.map((p) => {
            const linked = links[p.id];
            const st = status(p.id);
            return (
              <div key={p.id} className="left-wrap">
                <button
                  className={`tile left ${selected === p.id ? 'selected' : ''} ${st}`}
                  style={linked && !done ? { borderColor: colorOf(p.id) } : undefined}
                  onClick={() => clickLeft(p.id)}
                >
                  {linked && !done && <span className="dot" style={{ background: colorOf(p.id) }} />}
                  {st === 'ok' && <span className="mark">✔</span>}
                  {(st === 'ko' || st === 'missing') && <span className="mark">✘</span>}
                  <span dangerouslySetInnerHTML={{ __html: p.leftHtml }} />
                </button>
                {done && st !== 'ok' && (
                  <div className="answer">
                    → <span dangerouslySetInnerHTML={{ __html: p.rightHtml }} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <div className="column">
          {rightOrder.map((rightId) => {
            const holder = leftLinkedTo(rightId);
            const st = holder ? status(holder) : '';
            return (
              <button
                key={rightId}
                className={`tile right ${st}`}
                style={holder && !done ? { borderColor: colorOf(holder) } : undefined}
                onClick={() => clickRight(rightId)}
              >
                {holder && !done && <span className="dot" style={{ background: colorOf(holder) }} />}
                <span dangerouslySetInnerHTML={{ __html: byId.get(rightId)!.rightHtml }} />
              </button>
            );
          })}
        </div>
      </div>

      {!done ? (
        <div className="bar">
          <span className="muted">
            {t('linked', Object.keys(links).length, pairs.length)} · {t('howTo')}
          </span>
          <span className="spacer" />
          <button className="primary" disabled={!Object.keys(links).length} onClick={check}>
            {t('check')}
          </button>
        </div>
      ) : (
        <div className="bar">
          <span>
            <b>{t('score', result!.correct.length, pairs.length)}</b>
          </span>
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

renderWidget(MatchingQueue);
