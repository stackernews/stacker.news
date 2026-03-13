# The Stacker News Editor: `extensions`

These are the Lexical Extensions we currently created and registered.

## `AutoLinkExtension`

used by: **Rich Editor; SSR Editor; Reader**

This extension intercepts the changes of `AutoLinkNode`s via `registerNodeTransform`  
Its purpose is to replace plain text URLs with Mentions, Embeds or Media.

### Pipeline

runs inside the `AutoLinkNode` transform while matching autolinks are created or updated

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

Its purpose is to receive the prepared item/viewer context (`imgproxyUrls`, `outlawed`, `rel`, `showImagesAndVideos`, `imgproxyOnly`) and change nodes' behaviors accordingly.  
This data is assembled by our resolvers plus `lexicalStateLoader()` and then passed through `prepareLexicalState` (our server-side Lexical state generator) to this extension.

### Pipeline

runs inside node transforms while the server editor state is being prepared

- `outlawed`
    - transforms `AutoLinkNode`, `LinkNode`, `MediaNode`, `EmbedNode` into `TextNode` with their source URL as text content.
- `rel`
    - sets `LinkNode` `rel` to the `rel` we received from context
      - fallback to `lib/constants.js` `UNKNOWN_LINK_REL`
- `showImagesAndVideos === false`
    - replaces `MediaNode` and `EmbedNode` with plain links to their source URL
- `imgproxyUrls`
    - gets the `srcSet` object from `imgproxyUrls[url]` where `url` is the source of a `MediaNode`, computing from it:
      - `srcSet`
      - `bestResSrc`
      - `width`
      - `height`
      - `video` [if imgproxy detected a video (true), image (false), or could not tell]
    - applies the computed values to `MediaNode`, converting the imgproxy `video` flag into the node `kind` (`video`, `image`, or `unknown`)
- `imgproxyOnly`
    - replaces `MediaNode` with a plain link when the media has no imgproxy metadata, or when imgproxy identifies it as a video (videos are not proxied)

For code clarity, outlawed+rel and imgproxy handling are declared separately, meaning we have to end our `register` function by returning the two distinctive cleanup functions

## `GalleryExtension`

used by: **Rich Editor; SSR Editor; Reader**

The `RootNode` transform listener allows us to scan the whole document. This extension groups adjacent top-level galleries and media-only paragraphs, where a media-only paragraph contains only **non-autolink** `MediaNode`s with known media kind (not `unknown`) plus optional line breaks.

### Pipeline

runs inside a `RootNode` transform once the top-level nodes are available

1. Iterate through all children of the root
2. For each child:
    - skip unless it is already a `GalleryNode` or a media-only paragraph
3. Collect all adjacent galleries and media-only paragraphs starting from the current position
4. If the collected range contains paragraphs:
    - reuse the first existing gallery in the range, or create a new `GalleryNode`
    - move all media nodes from the collected items into that gallery, preserving document order
    - remove the original gallery/paragraph containers that were merged
5. After merging, unwrap any gallery that now contains only a single media node back into a paragraph

This keeps consecutive images/videos grouped together, merges new media into neighboring galleries, and avoids leaving one-item galleries behind.

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
| `SN_FORMAT_COMMAND` | Text formatting (bold, italic, underline, code, superscript, subscript, strikethrough) |
| `SN_FORMAT_BLOCK_COMMAND` | Block formatting (paragraph, h1-h3, bullet, number, check, quote, code) |
| `SN_TOGGLE_LINK_COMMAND` | Toggle link on/off |
| `SN_INSERT_MATH_COMMAND` | Insert inline or block math equation |
| `MD_FORMAT_COMMAND` | Direct markdown syntax insertion (wraps selection with syntax markers) |

## `MarkdownTextExtension`

used by: **Markdown Editor**

A custom text extension for the markdown mode editor. Built on top of `registerRichText` for baseline selection/editing behavior, then intercepts and blocks everything that would produce rich-text formatting.
Undo/redo still comes from `HistoryExtension`, which is registered in `components/editor/editor.js`.

- **Blocks** `FORMAT_TEXT_COMMAND` and `FORMAT_ELEMENT_COMMAND` at `CRITICAL` priority
- **Blocks** drag and drop (`DRAGSTART_COMMAND`, `DROP_COMMAND`, `DRAGOVER_COMMAND`)
- **Intercepts paste** to only handle `text/plain` data
- **Intercepts copy/cut** to only output `text/plain` data

Conflicts with: `@lexical/rich-text`, `@lexical/plain-text`  
Depends on: `DragonExtension` (speech-to-text support)

## `DecoratorClickZonesExtension`

used by: **Rich Editor**

Detects clicks near the top or bottom edge (16px zones) of top-level unwritable nodes (decorators, or elements whose children are all decorators) and inserts a paragraph at that boundary.

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

A debugging extension that logs clipboard data on copy and paste events. Intercepts `COPY_COMMAND` and `PASTE_COMMAND` at `HIGH` priority and logs common clipboard formats (`text/plain`, `text/html`, `application/x-lexical-editor`). Only the paste handler computes and logs a hex-encoded representation of the plain text payload.

Returns `false` from both handlers so the events still propagate to their normal handlers.

Not registered in any editor configuration by default — meant to be temporarily wired in during development to inspect clipboard behavior.

## `MuteLexicalExtension`

used by: **Reader**

DOM Translators (like Google Translate) modify text via `characterData` mutations. Lexical's MutationObserver detects these and restores the DOM to match the EditorState, effectively reverting translations.

This extension replaces Lexical's observer with one that filters out text mutations, allowing translations to persist. Structural mutations (`childList`) still work, so decorators remain functional.

Can be disabled via `{ disabled: true }` in the extension config.
