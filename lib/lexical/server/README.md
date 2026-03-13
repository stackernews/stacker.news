# The Stacker News Editor: `server`

Server-side rendering and processing utilities. These run in Node.js (the worker or Next.js API routes) and must never be used in the browser.

## Structure

```
lib/lexical/server/
├── dom.js           # withDOM — fake DOM environment for SSR
├── interpolator.js  # markdown → Lexical state pipeline
├── loader.js        # DataLoader for batched state preparation
└── html.js          # Lexical state → HTML generation
```

The headless editor factory (`createSNHeadlessEditor`) lives at `lib/lexical/headless.js` and is shared between server and client code.

## Pipeline

```
markdown text (from DB)
     │
     ▼ prepareLexicalState (interpolator.js)
     │  ├── createSNHeadlessEditor()
     │  ├── register ItemContextExtension, AutoLinkExtension, GalleryExtension
     │  ├── markdownToLexical(editor, text)
     │  ├── $trimEmptyNodes()
     │  └── JSON.stringify(editorState)
     │
     ▼ serialized Lexical EditorState (JSON string)
     │
     ├──▶ sent to client for hydration (SNReader)
     │
     └──▶ lexicalHTMLGenerator (html.js)
          ├── withDOM() — creates a fake DOM via LinkeDOM
          ├── $generateHtmlFromNodes(editor)
          ├── sanitizeHTML() — DOMPurify
          └── returns HTML string
```

## `dom.js`

### `withDOM(fn)`

Wraps a function with a fake DOM environment (LinkeDOM) for SSR. Sets `global.window` and `global.document` for the duration of `fn`, then restores them. If a DOM already exists (nested calls), reuses it.

## `interpolator.js`

### `prepareLexicalState({ text, context })`

Converts markdown text to a serialized Lexical EditorState. Registers `ItemContextExtension`, `AutoLinkExtension`, and `GalleryExtension` on the headless editor so that:

- URLs are detected and transformed into mentions, embeds, and media nodes
- Media nodes receive imgproxy URLs, dimensions, and srcSets from context
- Outlawed items have their links/media stripped to plain text
- Adjacent media nodes are grouped into galleries

The context object comes from the GraphQL resolvers via the DataLoader and includes `imgproxyUrls`, `rel`, `outlawed`, `showImagesAndVideos`, and `imgproxyOnly`.

## `loader.js`

### `lexicalStateLoader({ me, userLoader })`

Creates a `DataLoader` that batches and deduplicates `prepareLexicalState` calls within the same GraphQL request tick. When multiple fields on the same item request the Lexical state, it's only computed once.

Computes `outlawed` status based on the viewer's sat filter settings vs the item's `netInvestment`.

## `html.js`

### `lexicalHTMLGenerator(lexicalState, options?, editorOptions?)`

Generates sanitized HTML from a serialized Lexical EditorState. Used by API routes when submitting items.

- Uses `withDOM()` to create a fake DOM
- Parses and sets the editor state
- Calls `$generateHtmlFromNodes` to produce HTML
- Sanitizes via DOMPurify (configurable via `sanitize: false`)
- Supports partial generation via `selection` option

## Connection to GraphQL Resolvers

The server pipeline is consumed by `api/resolvers/item.js` through two field resolvers:

- **`lexicalState`** — calls `lexicalStateLoader.load({ text, context })` to convert stored markdown into a Lexical JSON state for client hydration (SNReader).
- **`html`** — same loader call, then passes the result to `lexicalHTMLGenerator()` for SSR fallback and `?html` debug rendering.

Both resolvers pass item context (`imgproxyUrls`, `rel`, `userId`, `parentId`, `netInvestment`) so the server pipeline can apply imgproxy srcSets, outlawed stripping, and rel attributes.

On the **write** path, items store plain markdown in `Item.text`. The `FormikBridgePlugin` converts editor content to markdown in both modes (via `$getMarkdown()`), so the API mutation always receives plain markdown. Upload IDs are extracted from the markdown text via `uploadIdsFromText()`.
