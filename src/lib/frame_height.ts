import { RNPlugin, usePlugin } from '@remnote/plugin-sdk';
import { RefObject, useEffect } from 'react';
import { MATCHING_WIDGET, SORTING_WIDGET } from './consts';

/**
 * Sizing the queue widgets' frames to their content.
 *
 * RemNote gives a Flashcard widget's frame a 500 px minimum (min-h-[500px]),
 * and the grow chain of lib/css.ts (Incremental RemNote's fix for its own
 * reader, a Plugin queue item) does not reach the frame of an ordinary
 * flashcard: a long list was cut at ~500 px, with a scrollbar inside and a
 * blank band below (seen 2026-10-21). So each widget measures its content and
 * publishes the height in session storage, and the index widget, the only one
 * whose registerCSS is applied, sets it as the frame's min-height. The frame is
 * then never shorter than the exercise; a long one makes the card scroll, as
 * RemNote does with any long card.
 */

const PLUGIN_ID = 'matching-cards';
const key = (widget: string) => `matching-cards.frame-height.${widget}`;

/** In a queue widget: publishes the height of `ref`'s element whenever it changes. */
export function useReportHeight(ref: RefObject<HTMLElement>, widget: string) {
  const plugin = usePlugin();
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let last = 0;
    const report = () => {
      const style = getComputedStyle(el);
      const height = Math.ceil(el.getBoundingClientRect().height + parseFloat(style.marginTop) + parseFloat(style.marginBottom));
      if (Math.abs(height - last) < 2) return;
      last = height;
      void plugin.storage.setSession(key(widget), height);
    };
    const observer = new ResizeObserver(report);
    observer.observe(el);
    report();
    return () => observer.disconnect();
  });
}

/**
 * The frame's min-height, and no shrinking on the way up to RemNote's scroll
 * surface. Measured in the Beautiful queue (RemNote 1.28, 2026-10-21), from the
 * frame up: div.min-h-[500px] › div.fade-in-first-load (overflow: hidden) ›
 * div.box-border (min-h-0) › .beautiful-queue-card-content (min-h-0) ›
 * .beautiful-queue-card-scroll-stage › .beautiful-queue-insight-scroll-layout ›
 * .rn-queue__content › .width-container-scroller (overflow: auto). All but the
 * stage could shrink, so a frame taller than the card was squeezed back and the
 * fade-in wrapper clipped it. Every div between .rn-queue__content and the
 * frame now keeps its content's height, and the scroller scrolls the card.
 */
const frameCss = (widget: string, height: number) => {
  const frame = `iframe[data-plugin-id="${PLUGIN_ID}"][src*="widgetName=${widget}&"]`;
  return `
${frame} {
  min-height: ${height}px !important;
  flex-shrink: 0 !important;
}
.rn-queue__content div:has(${frame}) {
  flex-shrink: 0 !important;
}`;
};

/** In the index widget: applies the published heights. */
export function registerFrameHeights(plugin: RNPlugin) {
  for (const widget of [MATCHING_WIDGET, SORTING_WIDGET]) {
    plugin.track(async (rp) => {
      const height = await rp.storage.getSession<number>(key(widget));
      if (typeof height === 'number' && height > 0) await plugin.app.registerCSS(`${PLUGIN_ID}-height-${widget}`, frameCss(widget, height));
    });
  }
}
