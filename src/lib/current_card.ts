import { AppEvents, usePlugin, WidgetLocation } from '@remnote/plugin-sdk';
import { useEffect, useState } from 'react';

export interface CurrentCard {
  remId: string;
  cardId?: string;
  revealed: boolean;
}

/**
 * The card a Flashcard widget is drawn on, kept current.
 *
 * RemNote keeps the widget's frame mounted from one card to the next (seen
 * 2026-10-21: the sorting widget stayed on its first item while the queue
 * moved on). Inside a Card Cluster it does not even fire QueueLoadCard per
 * sibling, and the context's remId can stay pinned: only `cardId` advances. So,
 * as Incremental RemNote's card_info_bar does, this takes the card id from
 * QueueLoadCard when it fires, polls the widget context every 400 ms for the
 * rest, and resolves the card's own rem from the card.
 */
export function useCurrentCard(): CurrentCard | null {
  const plugin = usePlugin();
  const [current, setCurrent] = useState<CurrentCard | null>(null);

  useEffect(() => {
    let alive = true;
    let lastKey: string | undefined;

    const apply = async (cardId: string | undefined, fallbackRemId: string | undefined, revealed: boolean) => {
      const key = cardId ?? fallbackRemId;
      if (!alive || !key) return;
      if (key === lastKey) {
        // Same card: only the reveal flag can have changed.
        if (revealed) setCurrent((prev) => (prev && !prev.revealed ? { ...prev, revealed: true } : prev));
        return;
      }
      lastKey = key;
      const card = cardId ? await plugin.card.findOne(cardId).catch(() => undefined) : undefined;
      const remId = card?.remId ?? fallbackRemId;
      if (alive && remId) setCurrent({ remId, cardId, revealed });
    };

    const fromContext = async () => {
      const ctx = await plugin.widget.getWidgetContext<WidgetLocation.Flashcard>().catch(() => undefined);
      if (ctx) await apply(ctx.cardId, ctx.remId, !!ctx.revealed);
    };

    void fromContext();
    const onLoad = (data: any) => void apply(data?.cardId, undefined, false);
    const onReveal = () => setCurrent((prev) => (prev ? { ...prev, revealed: true } : prev));
    plugin.event.addListener(AppEvents.QueueLoadCard, undefined, onLoad);
    plugin.event.addListener(AppEvents.RevealAnswer, undefined, onReveal);
    const timer = setInterval(fromContext, 400);
    return () => {
      alive = false;
      clearInterval(timer);
      plugin.event.removeListener(AppEvents.QueueLoadCard, undefined, onLoad);
      plugin.event.removeListener(AppEvents.RevealAnswer, undefined, onReveal);
    };
  }, []);

  return current;
}
