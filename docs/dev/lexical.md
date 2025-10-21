# Sine structura, verba cadunt.
<sup>without structure, words fall</sup>

Lexical is a very powerful framework - and that's it, pack it up guys go home.

# State of Lexical oct 20

# Plugins
## Core

### **`CodeShikiPlugin`**

Register code highlighting via Shiki
- Applies the theme `github-dark-default || github-light-default` via `useDarkMode`
- supports theme changes via dark mode toggle

### **`ModeSwitchPlugin`**

Button to switch between Markdown Mode and Rich Mode
- renders `markdown mode|rich mode` button
- dispatches the `SN_TOGGLE_MODE_COMMAND`

### **`PreferencesPlugin`**: Debug tool

Uses the **`LexicalPreferences`** context to configure default behaviors
- start in markdown
- show full toolbar
- show floating toolbar

### **`ShortcutsPlugin`**

Keyboard shortcuts for every command

Listens to `KEY_DOWN_COMMAND` (onKeyDown), normalizes the input and parses it for OS-independent shortcuts

This improves DX in creating keyboard shortcuts: `mod+alt+5` can be `cmd+opt+5` or `meta+alt+5`

Shortcuts are categorized in
- formatting: block, inline, align, indent
- inserts
- editor

The `DefaultShortcuts` list can be found at `@components/lexical/universal/constants/actions`

### **`FormikPlugin`**

This is a basic formik bridge with local storage integration via `StorageKeyPrefixContext`
- gets draft from local storage and populates the editor (first load)
- on editor changes (writing)
  - local storage: saves the current `lexicalState` JSON or, if empty, removes the item from local storage
  - formik:
    - markdown mode:
      - parse markdown node into markdown text
      - parse markdown text into `lexicalState`
      - returns `{ markdown, lexicalState }`
    - rich mode:
      - converts the `lexicalState` to markdown text
    - sets `values.text` and `values.lexicalState`
- listens to formik's `resetForm` by checking if `lexicalState` went from 'something' to empty
  - re-initializes the editor


## Decorative

### **`MentionsPlugin`**

Based on **`LexicalTypeaheadMenuPlugin`**

Triggers a dropdown on `@` or `~`, renders the dropdown via a portal

Suggestions are retrieved with a lazy query to `getSubSuggestions`/`getUserSuggestions`, clicking on one of them will create a `UserMention` or `TerritoryMention` node.

## Inserts

### **`LinkTransformationPlugin`**

- Allows pasting into a selection to create a Link node
- Selecting or creating a Link node will spawn `LinkEditor`

### **`LinkEditor`**

Creates a portal to a link editor component

Handles positioning by getting the bounding rects of the selection

### **`FileUploadPlugin`**

Based on the `FileUpload` component

Allows uploading multiple files at once

Creates a placeholder node for each file, replaces it with the actual node when the upload is complete

- The placeholder node displays the upload progress as text: `Uploading {file.name}… {percent}%` - via XHR
- The actual node is a `MediaNode` with the file's URL
WIP: Updates the upload fees via mutation

<details>
<summary><b>Nodes</b></summary>

## **Core**

### **`MarkdownNode`**

The basis of Markdown Mode
- Special code node with language set to `markdown`
  - cannot be removed if not from the toggle (via `bypassProtection()`)

## Content

### **Embeds**

- **`EmbedNode`**: creates a `provider` embed, recognizes an embed 
- every embed has a `placeholderNode` for HTML that mimicks loading 

### **Media**

- **`MediaNode`**: supports captions and resizing
- **`MediaResizer`**: resizing interface for images, sets the node's dimensions
  - TODO: took from lexical and the dimensions erroneously clamp to a `max-width` of `100px`, should be fixed before release
- **`MediaComponent`**: enables captions and resizing, uses `MediaOrLink` for carousel and link fallbacks
  - receives and handles `imgproxyUrls`, `rel`, `outlawed` via `useLexicalItemContext`

## Decorative

### **Mentions**

- **`UserMention`**: decorated via `UserPopover`
- **`TerritoryMention`**: decorate via `SubPopover`

Both works the same way: get the mention, create a link.
Could be merged into a single node but they're separated for DX reasons.

## Formatting

### **Math**

- **`MathNode`**: exports HTML with KaTeX, renders KaTeX via `MathComponent`
- **`MathComponent`**: Renders KaTeX with a given `math` string, with double click it spawns `MathEditor` that renders a dedicated `textarea` for plain text math edits.

**Spoiler**: based on `Container`, `Details` and `Summary`, should be merged into **SpoilerNode**
- Provides inline and full spoiler containers

</details>

<details>
<summary><b>Transformers</b></summary>
Transformers are used to convert between Lexical nodes and Markdown.

## Content
### **`MEDIA_OR_LINK`** or autolink

From Markdown:
- Regex: `URL_REGEXP (https://example.com)`
- Replace: checks if the bare url is embed/media/link and creates the appropriate node

From Lexical:
- Export: converts the embed/media/link node to a plain link `https://example.com`, proper markdown link `[text](url)` or media `![alt text](url)`

### **`MEDIA`**

From Markdown:
- Regex: `![](src ?"caption"?)`
- Replace: creates a `MediaNode` with caption if `![](src "caption")`

From Lexical:
- Export: converts the `MediaNode` to a proper markdown image `![alt text](url)`

QUIRK: Doesn't retain the resized dimensions of the image.

## Decorative

### **`LINK`**

Extends the default `LINK` transformer

From Markdown:
- Regex: `[](url)`
- Replace: creates a `LinkNode` with url `(url)`, and appends a text node `[text]` to it

From Lexical:
- Export: converts the `LinkNode` to the equivalent `[text](url "title")`

### **`USER_MENTIONS/TERRITORY_MENTIONS`**

From Markdown:
- Regex: `@user/~sub`
- Replace: creates a `UserMention`/`TerritoryMention` node

From Lexical:
- Export: converts the `UserMention`/`TerritoryMention` node to `@user/~sub`

## Formatting

### **`ALIGN`**

From Markdown:
- Regex: `<div align="left|center|right|justify|start">text</div>`
- Replace: creates a paragraph node with `formatType` `left|center|...`

From Lexical:
- Export: gets the `formatType` of the paragraph and transforms it into e.g. `<div align="left">text</div>`

### **`MATH`**

From Markdown:
- Regex: `$2+2=5$`
- Replace: creates a Math node

From Lexical:
- Export: if inline `$2+2=5$`, else `$$\n2+2=5\n$$`

## Misc

### **`HR`**: deprecated but still there

### **`TABLES`**
WIP, barely working

</details>


