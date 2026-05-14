# The Hitchhiker's Guide to Lexical: `extensions`

These are the Lexical Extensions we currently created and registered.

## `AutoLinkExtension`

used by: **SSR Editor; Reader**

This extension intercepts the changes of `AutoLinkNode`s via `registerNodeTransform`  
Its purpose is to replace plain text URLs with Mentions, Embeds or Media.

### Pipeline

happens: **before** the editor state has been applied

When an `AutoLinkNode` is created or modified:

1. Is it an internal link?
    - check if it's an item mention (e.g. https://stacker.news/items/123456)
      - replace `AutoLinkNode` with `ItemMentionNode`
2. Is the `AutoLinkNode` standalone in its own paragraph?
    - check if it's an embed URL
      - replace the **parent paragraph** of `AutoLinkNode` with `EmbedNode`
        - `EmbedNode` is a `DecoratorBlockNode`, and it shouldn't be inserted in a paragraph
    - create a `MediaNode` signaling that it comes from an `AutoLinkNode`
3. Nothing applies, replace the node with a full `LinkNode`


## `ItemContextExtension`

used by: **SSR Editor**

This extension intercepts the changes of the following nodes via `registerNodeTransform`:

- `AutoLinkNode`
- `LinkNode`
- `MediaNode`
- `EmbedNode`

Its purpose is to receive the context of an item (`imgproxyUrls`, `outlawed`, `rel`) and change nodes' behaviors accordingly.  
This data is received from our resolvers via DataLoader and passed through `prepareLexicalState` (our server-side Lexical state generator) to this extension.

### Pipeline

happens: **before** the editor state has been applied

- `outlawed`
    - transforms `AutoLinkNode`, `LinkNode`, `MediaNode`, `EmbedNode` into `TextNode` with their source URL as text content.
- `rel`
    - sets `LinkNode` `rel` to the `rel` we received from context
      - fallback to `lib/constants.js` `UNKNOWN_LINK_REL`
- `imgproxyUrls`
    - gets the `srcSet` object from `imgproxyUrls[url]` where `url` is the source of a `MediaNode`, computing from it:
      - `srcSet`
      - `bestResSrc`
      - `width`
      - `height`
      - `video` [if imgproxy detected a video (true) or an image (false)]
    - apply the aforementioned values to `MediaNode`

For code clarity, outlawed+rel and imgproxy handling are declared separately, meaning we have to end our `register` function by returning the two distinctive cleanup functions

## `GalleryExtension`

used by: **SSR Editor; Reader**

The `RootNode` transform listener allows us to scan the whole document. This extension uses it to collect adjacent paragraphs containing only **non-autolink** `MediaNode`.

### Pipeline

happens: **after** the editor state has been applied

1. Iterate through all children of the root
2. For each child:
    - skip if it's already a `GalleryNode`
    - skip if it's not a non-autolink `MediaNode` paragraph
3. If a media-only paragraph is found:
    - collect all adjacent media-only paragraphs starting from current position
    - extract all `MediaNode`s from these paragraphs (flattened into a single array)
    - if less than 2 adjacent media nodes found, skip (no gallery needed)
    - otherwise:
        - create a new `GalleryNode`
        - insert it before the first paragraph
        - append all media nodes to the gallery
        - remove all the original paragraphs
    - skip ahead by the number of paragraphs processed

This ensures that multiple consecutive images/videos are automatically grouped into a gallery, while single media items remain as standalone paragraphs.

## `CodeShikiSNExtension`

used by: **Editor; Reader**

Re-implementation of `@lexical/code-shiki` that loads Shiki languages and themes on-demand instead of inlining all of them into the main bundle. The upstream package ships as a single 9 MB `.mjs` that statically embeds every TextMate grammar as a `JSON.parse` literal, which Webpack cannot tree-shake. We replace it with a thin layer over `@shikijs/core` + `@shikijs/engine-javascript` + `shiki/langs` + `shiki/themes`, where each language/theme is fetched as its own dynamically-imported chunk the first time a code block uses it.

The extension is composed across `lib/lexical/exts/shiki/`:

- `highlighter.js` — Shiki singleton created with `createHighlighterCoreSync({ engine, langs: [], themes: [] })`. Exposes `loadCodeLanguage` / `loadCodeTheme` (which trigger the dynamic imports and `markDirty` the dependent `CodeNode` once loaded), plus `isCodeLanguageLoaded` / `isCodeThemeLoaded` and the `normalizeCodeLanguage` alias map used by the toolbar.
- `tokenizer.js` — `ShikiTokenizer.$tokenize` calls `$getHighlightNodes`, which runs `shiki.codeToTokens` and maps tokens to `CodeHighlightNode` / `TabNode` / `LineBreakNode`. Also implements diff-prefix decoration for `diff-xxxx` languages.
- `transforms.js` — `$codeNodeTransform`, `$textNodeTransform`, `$updateAndRetainSelection`, `getDiffRange`, `isEqual`, `updateCodeGutter`, `$isSelectionInCode`. Same selection-retaining minimal-diff splice as upstream.
- `handlers.js` — `$handleTab` / `$handleMultilineIndent` / `$handleShiftLines` / `$handleMoveTo` so Tab, Alt+Up/Down, and Cmd-Home/End behave the way users expect inside a code block.
- `register.js` — `registerCodeHighlighting(editor, tokenizer)` glues the transforms and command handlers onto the editor and tracks `data-gutter` line numbers via a mutation listener.
- `index.js` — the public `CodeShikiSNExtension`. Depends on `CodeExtension` (from `@lexical/code-core`) so `CodeNode` / `CodeHighlightNode` registration and the Enter-thrice exit handler come for free.

We add a `UPDATE_CODE_THEME_COMMAND` listener that:

1. Calls `setTheme(newTheme)` on every existing `CodeNode` so the highlight transform reruns and repaints them.
2. Mutates `tokenizer.defaultTheme` so any new `CodeNode` picks the right theme before the transform sets one on the node.

It's paired with `CodeThemePlugin` which listens to the `useDarkMode` hook and dispatches `UPDATE_CODE_THEME_COMMAND` with `github-light-default` or `github-dark-default` whenever SN's theme changes.




