import { renderWidget, usePlugin } from '@remnote/plugin-sdk';
import React, { useEffect, useMemo, useState } from 'react';
import '../style.css';
import { useCurrentCard } from '../lib/current_card';
import { Grade, grade, Links, shuffle, suggest } from '../lib/grading';
import { readPairs } from '../lib/matching';
import { t } from '../lib/i18n';

/**
 * Drawn on the card of every rem with the Matching powerup. The learner taps
 * an item on the left, then its match on the right (taps work the same with a
 * mouse and on a phone, unlike drag and drop). "Check" grades the links and
 * reveals the answer, so RemNote's own rating buttons appear; the widget names
 * the rating it suggests. The exercise is one card, so that rating schedules
 * the whole exercise.
 */

interface ViewPair {
  id: string;
  leftHtml: string;
  rightHtml: string;
  rightText: string;
}

const COLORS = ['#2563eb', '#d97706', '#7c3aed', '#059669', '#db2777', '#0891b2', '#65a30d', '#dc2626', '#4f46e5', '#ca8a04'];

function MatchingExercise({ remId, cardId, revealed }: { remId: string; cardId?: string; revealed: boolean }) {
  const plugin = usePlugin();
  const [pairs, setPairs] = useState<ViewPair[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [links, setLinks] = useState<Links>({});
  const [result, setResult] = useState<Grade | null>(null);

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
    })();
  }, [remId]);

  // A new order every day, stable while the card is on screen.
  const rightOrder = useMemo(
    () => (pairs ? shuffle(pairs.map((p) => p.id), `${cardId ?? remId}:${new Date().toDateString()}`) : []),
    [pairs]
  );

  // Revealed by RemNote (space bar, its button) without "Check": grade whatever was linked, so the answer shows.
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
  if (!card) return null;
  // A fresh exercise (links and all) for every card the queue shows.
  return <MatchingExercise key={card.cardId ?? card.remId} remId={card.remId} cardId={card.cardId} revealed={card.revealed} />;
}

renderWidget(MatchingQueue);
