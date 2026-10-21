import { AppEvents, RNPlugin } from '@remnote/plugin-sdk';
import { createExercise, ExerciseKind, makeExercise } from './matching';

/**
 * Matching cards and sorting exercises for other plugins (an importer, say). The same channel as
 * Incremental RemNote's Priority Bridge: plugin storage is private, but writing
 * a SESSION key emits `storage.session.changed` under the bare key to every
 * plugin listening on it. A client writes a request into its own session
 * storage and receives our answer the same way. Session storage is in memory
 * and never synced, so nothing accumulates and no other device replays it.
 * Nothing is queued while this plugin is off: a client pings first, and may
 * wait for `ready`, which we announce at startup.
 *
 * PROTOCOL v1 (every payload carries a requestId; answers echo it)
 *   ping     {requestId}                                   → pong {requestId, version}
 *   create   {requestId, kind, parentId, position?, prompt, pairs: [{left, right}]}
 *                                                          → created {requestId, ok, remId?, error?}
 *            kind 'matching' (one card) or 'sorting' (left = item, right =
 *            its pile; one card per item). prompt / left / right are RemNote
 *            rich text (store images first: a data: URI in a rem's text is
 *            not displayed).
 *   convert  {requestId, kind, remId}                      → converted {requestId, ok, pairs?, error?}
 *            the rem's children written as `left :: right` become its pairs.
 */
export const BRIDGE_VERSION = 1;
export const BRIDGE_KEYS = {
  ready: 'matching-bridge.v1.ready',
  ping: 'matching-bridge.v1.ping',
  pong: 'matching-bridge.v1.pong',
  create: 'matching-bridge.v1.create',
  created: 'matching-bridge.v1.created',
  convert: 'matching-bridge.v1.convert',
  converted: 'matching-bridge.v1.converted',
} as const;

type Payload = Record<string, any> | undefined;

/** The listener receives the value itself, or wrapped as {value}. */
const unwrap = (raw: any): Payload => (raw && typeof raw === 'object' && 'value' in raw && !('requestId' in raw) ? raw.value : raw);

/** Requests already handled in this realm: the event can arrive more than once. */
const handled = new Set<string>();
const firstTime = (kind: string, requestId: unknown) => {
  if (typeof requestId !== 'string' || !requestId) return false;
  const key = `${kind}:${requestId}`;
  if (handled.has(key)) return false;
  handled.add(key);
  if (handled.size > 500) handled.delete(handled.values().next().value as string);
  return true;
};

const kindOf = (kind: unknown): ExerciseKind => (kind === 'sorting' ? 'sorting' : 'matching');

const reply = (plugin: RNPlugin, key: string, value: Record<string, any>) =>
  plugin.storage.setSession(key, { ...value, at: Date.now() });

export function registerBridge(plugin: RNPlugin) {
  plugin.event.addListener(AppEvents.StorageSessionChange, BRIDGE_KEYS.ping, async (raw: any) => {
    const msg = unwrap(raw);
    if (!firstTime('ping', msg?.requestId)) return;
    await reply(plugin, BRIDGE_KEYS.pong, { requestId: msg!.requestId, version: BRIDGE_VERSION });
  });

  plugin.event.addListener(AppEvents.StorageSessionChange, BRIDGE_KEYS.create, async (raw: any) => {
    const msg = unwrap(raw);
    if (!firstTime('create', msg?.requestId)) return;
    try {
      const rem = await createExercise(plugin, {
        kind: kindOf(msg!.kind),
        parentId: String(msg!.parentId ?? ''),
        position: typeof msg!.position === 'number' ? msg!.position : undefined,
        prompt: Array.isArray(msg!.prompt) ? msg!.prompt : [String(msg!.prompt ?? '')],
        pairs: Array.isArray(msg!.pairs) ? msg!.pairs : [],
      });
      await reply(plugin, BRIDGE_KEYS.created, { requestId: msg!.requestId, ok: true, remId: rem._id });
    } catch (e: any) {
      await reply(plugin, BRIDGE_KEYS.created, { requestId: msg!.requestId, ok: false, error: e?.message ?? String(e) });
    }
  });

  plugin.event.addListener(AppEvents.StorageSessionChange, BRIDGE_KEYS.convert, async (raw: any) => {
    const msg = unwrap(raw);
    if (!firstTime('convert', msg?.requestId)) return;
    try {
      const rem = typeof msg!.remId === 'string' ? await plugin.rem.findOne(msg!.remId) : undefined;
      if (!rem) throw new Error('rem not found');
      const pairs = await makeExercise(rem, kindOf(msg!.kind));
      await reply(plugin, BRIDGE_KEYS.converted, { requestId: msg!.requestId, ok: true, pairs });
    } catch (e: any) {
      await reply(plugin, BRIDGE_KEYS.converted, { requestId: msg!.requestId, ok: false, error: e?.message ?? String(e) });
    }
  });

  // Clients waiting for us resend once they hear this.
  void reply(plugin, BRIDGE_KEYS.ready, { requestId: `ready-${Date.now()}`, version: BRIDGE_VERSION });
}
