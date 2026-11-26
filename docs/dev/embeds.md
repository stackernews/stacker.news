# Embeds

A link that stands alone in its paragraph is rendered as an embed when we
support its site. There are two kinds of embeds.

- Iframe embeds (YouTube, Spotify, Rumble, Wavlake, PeerTube) are rendered by
  `components/embed.js` straight from the link. Nothing is fetched or saved on
  our side.
- Card embeds (X and nostr) are fetched on the server, saved with the item, and
  rendered by `EmbedCard` in `components/embed-card.js`.

# Card Embeds

## How a link becomes a card

1. `AutoLinkExtension` in `lib/lexical/exts/autolink.js` calls `parseEmbedUrl`
   from `lib/url.js` on every link that stands alone in its paragraph. For a
   supported link, `parseEmbedUrl` returns its `provider` and `id`, and the link
   is replaced by an `EmbedNode`. The extension runs in the editor and on the
   server.
2. When an item is created or edited, the `embeds` job in `worker/embeds.js`
   fetches the data of every card link in the item's text and in the url of a
   link post. It saves the data in the `Embed` table, one row per provider and
   id, and links the item to its rows through the `ItemEmbed` table.
3. When an item is read, the loader made by `createItemEmbedsLoader` in
   `api/loaders.js` loads the saved data of the item. The `lexicalState` and
   `html` resolvers pass it to `lexicalStateLoader`, and `ItemContextExtension`
   in `lib/lexical/exts/item-context.js` sets it on each `EmbedNode`. A link
   post renders the embed of its url below the text, and that embed gets its
   data from the `urlEmbed` field of the item.
4. `EmbedCard` renders the card from the saved data. When there is no saved
   data, for example in the editor or on items saved before the job existed, it
   asks the `embed` query for the data. If the query returns nothing too, the
   card shows a plain link.

Until the client renders the card, the server HTML shows a skeleton written by
`EmbedNode.exportDOM`.

## Writing a provider

A provider is a module in `lib/embeds/` with two functions, registered as
`fetch` and `normalize` in `PROVIDERS` in `lib/embeds/index.js`. For X they are
`fetchTweet` and `normalizeTweet` in `lib/embeds/twitter.js`, and for nostr
`fetchNostr` and `normalizeNostr` in `lib/embeds/nostr.js`.

`fetch(id)` gets the raw data from the provider's API or relays.

- It returns the raw data when the post exists.
- It returns `null` when the post doesn't exist.
- It throws when the service can't be reached. The job then fails, and pg-boss
  runs it again later, up to 5 times.

`normalize(raw)` turns the raw data into embed data.

- It returns `null` for something we don't show, for example a nostr event of a
  kind we have no card for.
- If it throws, the card shows a plain link. The job doesn't retry, because the
  same raw data would fail again.

`getEmbedData` in `lib/embeds/index.js` calls both functions. It caches the
result in memory for an hour, including "not found", so the provider is not
asked again on every view.

When a link that was found before is not found later, or its fetch fails, the
item keeps the data that was saved last.

## Embed data

Every provider returns the same shape, described by the `EmbedData` typedef in
`lib/embeds/index.js`. A few rules apply to all providers.

- The text is a list of segments: `{ text }` for plain text and
  `{ text, href }` for a link. The card renders them in order. A provider never
  returns HTML.
- Images go through `embedAvatar` and `embedPicture` in `lib/embeds/images.js`.
  They return imgproxy paths without the host, and the card adds the host when
  it renders them, so saved data keeps working if the imgproxy host changes.
  Both return `null` for a url that is not safe to show, and the provider then
  leaves that image out.
- A media item has `src` and `src2x` from `embedPicture`, and can have `width`,
  `height` and `alt`. For a video, the picture is the poster, `video` is the url
  of an mp4 file and `loop` is true for gifs.
- `preview` is a link preview with `href`, `title`, `domain` and `image`.
- A field that a post can have but doesn't have is `null`. A field that a kind
  of post never has is left out.

Some parts of the card are written for X only:

- Only the X provider sets `truncated` and `poll`. When they are true, the card
  adds a "show more on X" or a "see the poll on X" link.
- The card plays `video` in an iframe that sends no referrer, because X refuses
  video requests from other sites.

A new provider that needs these has to change the card first.

## Adding a provider

1. In `lib/url.js`, make `parseEmbedUrl` recognize the provider's links and
   return `{ provider, id }`. The `id` is what the provider needs to fetch the
   post.
2. In `lib/embeds/`, add a module for the provider with `fetch` and `normalize`,
   as described in [Writing a provider](#writing-a-provider).
3. In `lib/embeds/index.js`, add the provider to `PROVIDERS`.
4. In `components/embed.js`, add the provider to the condition that sends
   twitter and nostr links to `EmbedCard`.
5. In `components/embed-card.js`, add the provider to `PROVIDERS` with its icon,
   its container class and the label of its expand button. Put the icon in
   `svgs/`.
6. In `lib/lexical/theme/index.js`, add an entry under `embeds` with a
   `container`, a `skeleton` and an `embed` class. `EmbedNode.exportDOM` writes
   the skeleton only for providers that have a `skeleton` class.
7. In `styles/text.css`, add the container class to the rule under
   `/* embed containers */`, and add a size block for the `embed` class.
   `--sn-embed-contained-height` is the height of the skeleton. It is also the
   height at which the text and media of a long post are collapsed behind the
   expand button.

   ```css
   .sn-embed--example {
     width: 100%;
     max-width: 350px;
     --sn-embed-contained-height: 150px;
   }

   .topLevel .sn-embed--example {
     max-width: 550px;
     --sn-embed-contained-height: 200px;
   }
   ```

8. In `pages/settings/index.js`, add the provider's site to the list of
   supported embeds.

You don't need to change:

- the job, the loader or the GraphQL schema, because none of them names a
  provider
- the database, because `Embed.provider` is a plain string
- `AutoLinkExtension`, because it gets every provider from `parseEmbedUrl`
- the content security policy, unless the card loads an iframe from the
  provider's site

## Checking a provider

- Write the bare url alone in its own paragraph. A url inside a sentence or a
  link with its own text stays a link.
- A post with fewer sats than a viewer's sat filter shows its embeds as plain
  text to that viewer, unless the viewer is the author. Check a test post as
  its author, or boost it.
- A card rendered from saved data sends no `embed` query. If the item page sends
  one for your link, the job didn't save data for it.
