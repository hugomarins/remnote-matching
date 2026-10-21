# Matching Cards

Two interactive exercise types for RemNote flashcards, in the style of Articulate Rise:

- **Matching**: drag each item onto its match. The whole exercise is **one card** with one schedule.
- **Sorting**: drag each item onto its group. Every item keeps **its own card** and schedule, and the items are practised together.

Both are written as ordinary rems (`left :: right` children), so they stay readable and editable in the editor, and they turn back into plain cards if the plugin is turned off.

![Matching: drag each item on the left onto its match](https://raw.githubusercontent.com/hugomarins/remnote-matching/main/assets/matching-activity.gif)

![Sorting: drag the card onto its group](https://raw.githubusercontent.com/hugomarins/remnote-matching/main/assets/sorting-activity.gif)

## Install

Once it is published in RemNote's plugin marketplace: **Settings → Plugins → Explore**, search for **Matching Cards**, and click **Install**. The plugin is enabled on mobile too.

Until then, build it (see [Develop](#develop)) and either run the dev server and choose **Develop from localhost** in **Settings → Plugins → Build**, or upload the `PluginZip.zip` that `npm run build` makes.

## Matching: one card, one schedule

Write the prompt, and under it one child per pair, as a regular card (`left :: right`):

```
Exemplos:
    modelos de escoamento de água, de manobra de navios… :: Modelos numéricos
    modelos de laboratório para investigar a propagação de ondas… :: Modelos analíticos
    análise elementar de ondas e as distribuições de frequência… :: Modelos físicos
```

Put the cursor in the prompt and run **Make Matching card** (command palette, `Ctrl/Cmd + K`). The prompt gets the **Matching** tag and becomes one forward card, its back side `⇄` only a marker (it reads `Exemplos: → ⇄`). The pairs' own cards are switched off (practice direction *none*). At least two pairs are needed.

**In the queue**, the right column stays put and the left items are puzzle pieces:

- **Drag** a piece onto the row of its match: it snaps into place and both stripes turn dark blue. The piece that was in that row moves to the spot you dragged from. A connected piece can be dragged again.
- **Or tap** a piece, then the row of its match.
- **Check** grades the connected rows: green ✔ right, red ✘ wrong, orange ✘ left unconnected, with the right item named under each mistake. The card is revealed and a rating is suggested: **Easy** with no mistake, **Hard** with one mistake in four or more pairs, **Forgot** otherwise.

## Sorting: one card per item, practised together

Write the exercise, and under it one child per item, as a regular card (`item :: its group`):

```
Classifique: Peso · Volume · Especializados
    Carga geral :: Peso
    Ro-Ro :: Volume
    Navio de guerra :: Especializados
    …
```

Put the cursor in the exercise and run **Make Sorting exercise**. The exercise gets the **Sorting** tag and RemNote's **Card Cluster**, so its items come up together; each item keeps its forward card (its hidden *Sorting Item* tag lets the plugin draw it). The groups are the distinct right sides, in the order they first appear. At least two groups are needed.

**In the queue**, each item is a card above the groups:

- **Drag** the card onto its group, **or tap** the group.
- The right group turns green (and your choice red, if it was wrong). The card is revealed and a rating is suggested: **Easy** if right, **Forgot** if not.

## Rating

After **Check** (Matching) or a drop (Sorting), the suggested rating is highlighted on RemNote's own answer button, with the "↵ Enter" tab RemNote shows for a *Type in Answer* card:

| Key | Does |
|---|---|
| **Enter** | Rates with the suggestion |
| **1 – 4** | Forgot · Hard · Easy · Instant, as usual |
| **Enter** or **Space**, after a Forgot | Goes to the next card, when RemNote shows its AI Explanation with "Next card" |

You can also click any answer button: the suggestion is only a suggestion. If you reveal the answer before checking (Space, or **Reveal Answer**), what you had connected is graded and the answer is shown.

Above each exercise, the plugin shows what RemNote would show above the card: the **breadcrumb** of its ancestors (click one to open it) and the exercise rem itself.

## Commands

| Command | On the rem with the cursor |
|---|---|
| **Make Matching card** | Turns its `left :: right` children into one Matching card. Run it again to repair one. |
| **Make Sorting exercise** | Turns its `item :: group` children into a Sorting exercise. |
| **Separate Matching/Sorting into plain cards** | Undoes either: every pair or item is a forward card again, and the tags (and the `⇄` back side) are removed. |

## Good to know

- **Editing.** The children are the truth: edit, add or remove pairs and items as usual, and the queue follows. For Sorting, a new item needs no command: add the *Sorting Item* tag, or run **Make Sorting exercise** again.
- **Without the plugin** (or with it turned off), the exercises are plain RemNote cards: the Matching prompt is a card whose back is `⇄` (its pairs are listed in the editor), and the Sorting items are forward cards.
- **Themes.** Light and dark follow RemNote's theme.
- **Incremental RemNote.** Meant to work alongside it: the suggested button's row is padded by the tab's height, so its docked card info bar rises above the "↵ Enter" tab as it does for RemNote's own suggestion.
- **Matching cards made with version 0.1.0** (Multi-Line cards, where only *Forgot* could be chosen) are converted to the current form when the plugin starts.

## For other plugins: the bridge

Plugins can create exercises (an importer, for instance). Same channel as Incremental RemNote's Priority Bridge: plugin storage is private, but writing a **session** key emits `storage.session.changed` under the bare key to every plugin listening on it. Write a request into your own session storage; the answer arrives the same way. Nothing is queued while Matching Cards is off: ping first.

| Request key | Payload | Answer key | Answer |
|---|---|---|---|
| `matching-bridge.v1.ping` | `{requestId}` | `matching-bridge.v1.pong` | `{requestId, version: 1}` |
| `matching-bridge.v1.create` | `{requestId, kind: 'matching' \| 'sorting', parentId, position?, prompt, pairs: [{left, right}]}` | `matching-bridge.v1.created` | `{requestId, ok, remId?, error?}` |
| `matching-bridge.v1.convert` | `{requestId, kind, remId}` (children already `left :: right`) | `matching-bridge.v1.converted` | `{requestId, ok, pairs?, error?}` |

For `sorting`, `left` is the item and `right` its group. `prompt`, `left` and `right` are RemNote rich text. Store images first: a `data:` URI in a rem's text is not displayed. `matching-bridge.v1.ready` is written when the plugin starts.

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
npm run dev     # http://localhost:8082 (RemNote: Settings → Plugins → Build → Develop from localhost)
npm test
npm run build   # PluginZip.zip
```

The images above are in [`assets/`](assets).
