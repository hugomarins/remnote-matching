# Matching Cards

Two exercise types for RemNote flashcards, both written as ordinary rems (`left :: right` children) so they stay editable, and degrade to plain cards without the plugin.

## Matching: one card, one schedule

```
Atenção especial deve ser dada aos seguintes aspectos:   ← Matching
    Ondas :: causam movimentos no navio…
    Gelos :: podem afetar a manobrabilidade…
    …
```

In the queue the card shows the left items and the right items, shuffled. Tap an item on the left, then its match on the right (tap a linked item again to undo). **Check** marks each link ✔ / ✘, shows the right answer under each mistake, and suggests a rating: Good with no mistake, Hard with one mistake in four or more pairs, Again otherwise. The whole exercise is one card (a Multi-Line card whose answer lines are the pairs), so it is scheduled as one.

To make one: write the prompt, its children as `left :: right`, put the cursor in the prompt and run **Make Matching card**. The pairs' own cards are switched off (practice direction "none").

## Sorting: one card per item, practised together

```
Classifique: Peso · Volume · Especializados   ← Sorting + Card Cluster
    Carga geral :: Peso
    Ro-Ro :: Volume
    Navio de guerra :: Especializados
    …
```

Each item keeps its own forward card and schedule. In the queue the item is a card to drag onto one of the groups (the distinct right sides, in the order they first appear), or tap a group. The right group turns green and a rating is suggested (Good if right, Again if not). The exercise rem carries RemNote's **Card Cluster**, so its items come up together.

To make one: children as `item :: group`, cursor in the parent, **Make Sorting exercise**.

**Separate Matching/Sorting into plain cards** undoes either.

## For other plugins: the bridge

Plugins can create exercises (an importer, for instance). Same channel as Incremental RemNote's Priority Bridge: plugin storage is private, but writing a **session** key emits `storage.session.changed` under the bare key to every plugin listening on it. Write a request into your own session storage; the answer arrives the same way. Nothing is queued while Matching Cards is off: ping first.

| Request key | Payload | Answer key | Answer |
|---|---|---|---|
| `matching-bridge.v1.ping` | `{requestId}` | `matching-bridge.v1.pong` | `{requestId, version: 1}` |
| `matching-bridge.v1.create` | `{requestId, kind: 'matching' \| 'sorting', parentId, position?, prompt, pairs: [{left, right}]}` | `matching-bridge.v1.created` | `{requestId, ok, remId?, error?}` |
| `matching-bridge.v1.convert` | `{requestId, kind, remId}` (children already `left :: right`) | `matching-bridge.v1.converted` | `{requestId, ok, pairs?, error?}` |

`prompt`, `left` and `right` are RemNote rich text. Store images first: a `data:` URI in a rem's text is not displayed. `matching-bridge.v1.ready` is written when the plugin starts.

```ts
const requestId = crypto.randomUUID();
plugin.event.addListener(AppEvents.StorageSessionChange, 'matching-bridge.v1.converted', (raw) => {
  const msg = raw?.value ?? raw;
  if (msg?.requestId === requestId) console.log(msg.ok ? `${msg.pairs} pairs` : msg.error);
});
await plugin.storage.setSession('matching-bridge.v1.convert', { requestId, kind: 'matching', remId });
```

## Develop

```
npm install
npm run dev     # http://localhost:8082 (RemNote: Plugins → Build → Develop from localhost)
npm test
npm run build   # PluginZip.zip
```
