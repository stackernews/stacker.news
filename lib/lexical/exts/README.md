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

## `MDCommandsExtension`

used by: **Editor**

It's a very simple extension that registers the commands for inserting markdown markers around a selection via `wrapMarkdownSelection`.

Commands:
- `MD_INSERT_LINK_COMMAND`: `[]()`
- `MD_INSERT_BOLD_COMMAND`: `** **`
- `MD_INSERT_ITALIC_COMMAND` `* *`

### `wrapMarkdownSelection`

1. gets the current selection from the editor
2. extracts the selected text content
3. wraps it with the provided prefix and suffix (e.g., `**text**` for bold)
4. inserts the wrapped text back into the editor
5. repositions the cursor using the specified `cursorOffset`:
   - for bold/italic: cursor is placed after the closing marker
   - for links: cursor is placed inside the `()` parentheses (offset of 1 from the end)


## `ShortcutsExtension`

used by: **Editor**

Also a very simple extension, it listens to `KEY_DOWN_COMMAND` (Lexical's equivalent to the `onkeydown` event) and matches the pressed keys against a brief `SHORTCUTS` registry.  
For `Stage 1` purposes, only meta/ctrl+key combinations are supported.

Example:

```javascript
  { // upload files
    key: 'u',
    handler: (editor) => editor.dispatchCommand(SN_UPLOAD_FILES_COMMAND)
  }
```

When the user presses `meta/ctrl+u` we call the handler that will then trigger the command `SN_UPLOAD_FILES_COMMAND`, executing whatever the command wants to do (in this case, it will open the file upload dialog).


## `CodeShikiSNExtension`

used by: **Reader**

Like the original `CodeHighlighterShikiExtension` it registers code highlighting via Shiki. We added the `UPDATE_CODE_THEME_COMMAND` listener to re-register the Shiki Highlighter with a new default theme.

It's paired with `CodeThemePlugin` that listens to the `useDarkMode` hook and calls `UPDATE_CODE_THEME_COMMAND` whenever SN's theme changes.

If we move from dark mode to light mode, it will re-register the highlighter with the `github-light-default` theme, and viceversa.




