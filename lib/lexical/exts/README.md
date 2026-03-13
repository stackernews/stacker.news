# The Stacker News Editor: `extensions`

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

Merges adjacent media into existing galleries and unwraps single-image galleries back into paragraphs.

## `FormattingCommandsExtension`

used by: **Markdown, Rich Editor**

Registers all formatting-related commands in a single extension, keeping command registration centralized.

```javascript
register: (editor) => {
  return mergeRegister(
    registerMDFormatCommand(editor),          // direct markdown format
    registerSNFormatCommand(editor),          // universal text formatting (bold, italic, etc.)
    registerSNFormatBlockCommand(editor),     // block formatting (headings, lists, code)
    registerSNToggleLinkCommand(editor),      // link toggle
    registerSNInsertMathCommand(editor)       // math insertion
  )
}
```

Each command is mode-aware: in rich mode it directly manipulates Lexical nodes; in markdown mode it uses the transformer bridge or `MD_FORMAT_COMMAND` to wrap/unwrap markdown syntax.

### Commands

| Command | Description |
|---|---|
| `SN_FORMAT_COMMAND` | Text formatting (bold, italic, code, superscript, subscript, strikethrough) |
| `SN_FORMAT_BLOCK_COMMAND` | Block formatting (paragraph, h1-h3, bullet, number, check, quote, code) |
| `SN_TOGGLE_LINK_COMMAND` | Toggle link on/off |
| `SN_INSERT_MATH_COMMAND` | Insert inline or block math equation |
| `MD_FORMAT_COMMAND` | Direct markdown syntax insertion (wraps selection with syntax markers) |

## `MarkdownTextExtension`

used by: **Markdown Editor**

A custom text extension for the markdown mode editor. Built on top of `registerRichText` (for undo/redo and base behavior) but intercepts and blocks everything that would produce rich-text formatting:

- **Blocks** `FORMAT_TEXT_COMMAND` and `FORMAT_ELEMENT_COMMAND` at `CRITICAL` priority
- **Blocks** drag and drop (`DRAGSTART_COMMAND`, `DROP_COMMAND`, `DRAGOVER_COMMAND`)
- **Intercepts paste** to only handle `text/plain` data
- **Intercepts copy/cut** to only output `text/plain` data

Conflicts with: `@lexical/rich-text`, `@lexical/plain-text`  
Depends on: `DragonExtension` (speech-to-text support)

## `DecoratorClickZonesExtension`

used by: **Rich Editor**

Detects clicks near the top or bottom edge (16px zones) of block-level decorator nodes (gallery, embed, etc.) and inserts a paragraph at that boundary.

This solves the problem where users can't place their cursor between two adjacent unwritable blocks, or before the first / after the last unwritable block in the document.

### Behavior

- Only triggers when the adjacent sibling is also unwritable (or doesn't exist)
- When both zones overlap (small decorators), prefers the closer edge; top wins ties
- Runs at `COMMAND_PRIORITY_NORMAL` to take precedence over default click handling
- Only active when the editor is editable

## `ApplePatchExtension`

used by: **Markdown, Rich Editor**

Fixes Safari/iOS-specific issues with decorator nodes and `contenteditable="false"` elements.

### Backspace Fix

Safari's native `deleteContentBackward` (triggered via `beforeInput`) can't handle deletions involving `contenteditable="false"` elements. Lexical's `KEY_BACKSPACE_COMMAND` calls `preventDefault()` on keydown, which suppresses `beforeInput` and breaks autocorrect, autocompletion, and hold-to-delete-word.

This extension returns `true` (handled) at `HIGH` priority so Lexical skips `preventDefault` and lets the native event fire — except when:
- A `NodeSelection` is active (decorator is focused and needs its own delete handler)
- The cursor is adjacent to a decorator node in any direction (native can't handle this)

### Enter Fix

Safari's native `insertParagraph` is a no-op inside blocks that only contain `contenteditable="false"` elements. This extension detects that case and explicitly creates and inserts a paragraph.

Active only on Apple platforms with `beforeInput` support.

Reference: [lexical#7994](https://github.com/facebook/lexical/issues/7994)

## `CodeShikiSNExtension`

used by: **Rich Editor and Reader**

Like the original `CodeHighlighterShikiExtension` it registers code highlighting via Shiki. We added the `UPDATE_CODE_THEME_COMMAND` listener to re-register the Shiki Highlighter with a new default theme.

It's paired with `CodeThemePlugin` that listens to the `useDarkMode` hook and calls `UPDATE_CODE_THEME_COMMAND` whenever SN's theme changes.

If we move from dark mode to light mode, it will re-register the highlighter with the `github-light-default` theme, and viceversa.

## `CopyPasteSniffExtension`

used by: **Debug only**

A debugging extension that logs clipboard data on copy and paste events. Intercepts `COPY_COMMAND` and `PASTE_COMMAND` at `HIGH` priority and logs all clipboard formats (`text/plain`, `text/html`, `application/x-lexical-editor`) along with hex-encoded representations of the plain text payload.

Returns `false` from both handlers so the events still propagate to their normal handlers.

Not registered in any editor configuration by default — meant to be temporarily wired in during development to inspect clipboard behavior.

## `MuteLexicalExtension`

used by: **Reader**

DOM Translators (like Google Translate) modify text via `characterData` mutations. Lexical's MutationObserver detects these and restores the DOM to match the EditorState, effectively reverting translations.

This extension replaces Lexical's observer with one that filters out text mutations, allowing translations to persist. Structural mutations (`childList`) still work, so decorators remain functional.

Can be disabled via `{ disabled: true }` in the extension config.
