# The Stacker News Editor: `editor`

This folder contains the React layer of the editor: the entry-point components, contexts, hooks, node components, and plugins.

## Structure

```
components/editor/
├── editor.js              # main editor component (SNEditor)
├── reader.js              # read-only renderer (SNReader)
├── index.js               # public exports
├── contexts/
│   ├── mode.js            # EditorMode context (markdown ↔ rich)
│   └── toolbar.js         # toolbar formatting state context
├── hooks/
│   ├── use-decorator-selection.js  # shared decorator node selection behavior
│   └── use-headless-bridge.js      # headless editor for transformer bridge
├── nodes/
│   ├── math/              # math equation component + styles
│   ├── media.js           # media (image/video) component
│   ├── mentions.js        # shared mention component (user, territory, item)
│   └── toc.js             # table of contents component
└── plugins/
    ├── core/              # essential plugins
    ├── link/              # floating link editor
    ├── toolbar/           # formatting toolbar + mode switch
    ├── mentions.js        # mention autocomplete
    ├── upload.js          # file upload handling
    └── patch/             # browser-specific patches
```

---

## Contexts

### EditorMode (`contexts/mode.js`)

Manages the current editing mode. The editor operates in two modes:

- **`markdown`** — plain text editing with markdown syntax. Uses `MarkdownTextExtension` under the hood, which blocks formatting commands and handles copy/paste as plain text.
- **`rich`** — full Lexical rich-text editing with MDAST-backed round-trip conversions.

When the mode changes, the editor is **destroyed and rebuilt** with a different configuration (different namespace, nodes, and extensions). Content is converted between modes via the MDAST pipeline.

```javascript
import { useEditorMode, MARKDOWN_MODE, RICH_MODE } from './contexts/mode'

const { mode, changeMode, toggleMode, isMarkdown, isRich } = useEditorMode()
```

#### Mode Detection in Non-React Code

`isMarkdownMode(editor)` — synchronous check via `editor._config.namespace === 'sn-markdown'`. Works in both Lexical transactions and outside them (update listeners, command handlers). Defined in `lib/lexical/commands/utils.js`.

### ToolbarContext (`contexts/toolbar.js`)

Tracks the current formatting state of the selection so toolbar buttons can reflect what's active.

```javascript
import { useToolbarState, INITIAL_FORMAT_STATE } from './contexts/toolbar'

const { toolbarState, updateToolbarState, batchUpdateToolbarState } = useToolbarState()
```

State includes: `blockType`, `isBold`, `isItalic`, `isCode`, `isLink`, `isStrikethrough`, `isSuperscript`, `isSubscript`, `showToolbar`, and more.

- `showToolbar` defaults to `false` unless `topLevel` is passed to `ToolbarContextProvider` (top-level post forms show the toolbar by default).
- `batchUpdateToolbarState(updates)` merges multiple updates into one render.

---

## Hooks

### `useDecoratorNodeSelection` (`hooks/use-decorator-selection.js`)

Shared behavior for all decorator (non-text) nodes. Handles click-to-select, focused-class toggling, delete/backspace removal, and Enter to insert a paragraph after the node.

```javascript
const { isSelected, setSelected, clearSelection, isFocused } = useDecoratorNodeSelection(nodeKey, {
  ref,            // narrow click target to a specific element
  focusedClass,   // CSS class toggled when focused
  deletable,      // enable delete/backspace (default: true)
  active,         // suspend commands, e.g. while an inline editor is open (default: true)
  onDoubleClick   // callback on double-click (e.g. break a mention into editable text)
})
```

It also fixes a Chrome issue where `contenteditable="false"` wrappers retain browser focus after Lexical deselects the node, breaking keyboard input.

### `useHeadlessBridge` (`hooks/use-headless-bridge.js`)

Creates a detached Lexical editor instance (built via `buildEditorFromExtensions`, not attached to any DOM element) used by the transformer bridge plugin to apply rich-text formatting operations to markdown selections.

```javascript
const bridgeRef = useHeadlessBridge({
  nodes,      // default: DefaultNodes
  theme,      // default: DefaultTheme
  extensions, // default: []
  name        // default: 'sn-headless-bridge'
})
```

The bridge is created once on mount and disposed on unmount.

---

## Node Components

### Math (`nodes/math/`)

React component rendered by `MathNode.decorate()`. Renders math equations using KaTeX with an inline editor.

**Behavior:**
- Auto-opens the editor for empty math nodes
- Live KaTeX preview while editing
- Double-click to open editor; Escape or click-away to close
- Click-to-copy in read-only mode
- Enter key opens editor when the node is selected
- Block math clears Lexical selection when its editor opens (to avoid visual conflict)

**Styles:** `math.module.css` provides separate styling for inline (`mathInlineContainer`) and block (`mathBlockContainer`) math, with editor and preview panels.

### Media (`nodes/media.js`)

Renders images and videos with lazy loading, carousel integration, and upload progress. Uses `useEditableCarousel` (see below) to disable carousel interactions during editing.

### Mentions (`nodes/mentions.js`)

Shared React component rendered by `UserMentionNode`, `TerritoryMentionNode`, and `ItemMentionNode` via `decorate()`. Handles both read-only and editable modes.

**Behavior:**
- **Read-only:** renders as a Next.js `<Link>` pointing to the mention's target
- **Editable:** renders as a `<span>` with double-click-to-edit support via `useDecoratorNodeSelection`'s `onDoubleClick`
- **Double-click (break mention):** converts the mention node back into editable form — `ItemMentionNode` becomes a `LinkNode` wrapping its URL; user/territory mentions become a `TextNode` with the original text (which re-triggers the mentions autocomplete menu)

### TOC (`nodes/toc.js`)

Table of contents component that extracts headings from the document.

---

## Plugins

### Core Plugins (`plugins/core/`)

#### `formik.js` — FormikBridgePlugin

Keeps Formik form state in sync with the editor on every content change. Non-content updates (selection changes, etc.) are skipped via `dirtyElements.size === 0 && dirtyLeaves.size === 0`.

Uses `$getMarkdown(editor)` which is mode-aware: in markdown mode it reads `$getTextContent()`, in rich mode it converts via `$lexicalToMarkdown()`.

- **Markdown mode:** sets `formik.text` to `$getMarkdown(editor)` instantly on every content change.
- **Rich mode:** sets `formik.text` to `$getMarkdown(editor)` via a debounced callback (500ms). While the debounce is pending, the fee button is disabled to prevent submission with stale content.
- **Empty editor:** sets `formik.text` to `''` so Formik validation catches required fields.
- **Blur:** forces an immediate (non-debounced) sync so the form always has current content when the editor loses focus.

Also registers:
- `SUBMIT_FORMIK_COMMAND` (used by the `Cmd+Enter` shortcut) — checks the fee button's `disabled` state before submitting.
- `SYNC_FORMIK_COMMAND` — forces an immediate sync (used by `ModeSwitchPlugin` before changing modes to ensure content is saved).

#### `local-draft.js` — LocalDraftPlugin

Auto-saves editor drafts to `localStorage` and restores them on mount.

- Storage key: `{storageKeyPrefix}-{name}` (e.g. `reply-123456-text`)
- Saves whenever Formik's `text` field value changes (which is always markdown, thanks to `FormikBridgePlugin`)
- Removes the draft when the text is empty
- On mount: prefers existing Formik value; falls back to loading from `localStorage`
- Mode-aware on load: uses `$setText()` in markdown mode, `$markdownToLexical()` in rich mode

#### `transformer-bridge.js` — TransformerBridgePlugin

Enables rich-text formatting in markdown mode by leveraging a headless Lexical editor as a bridge.

When a user selects text in markdown mode and applies formatting (bold, link, math, etc.):
1. The selected markdown text is extracted
2. It's imported into the headless bridge editor as Lexical nodes
3. The formatting operation is applied in the bridge
4. The result is exported back to markdown
5. The new markdown replaces the original selection

Supports `format`, `block`, `link`, and `math` transformation types via `USE_TRANSFORMER_BRIDGE` command.

#### `shortcuts.js` — ShortcutsPlugin

Registers keyboard shortcuts at `COMMAND_PRIORITY_HIGH`. Matches against `e.code` (physical key) rather than `e.key` (character) for layout-independent behavior.

| Shortcut | Action |
|---|---|
| `Cmd/Ctrl + B` | Bold |
| `Cmd/Ctrl + I` | Italic |
| `Cmd/Ctrl + K` | Toggle link |
| `Cmd/Ctrl + E` | Inline code |
| `Cmd/Ctrl + .` | Superscript |
| `Cmd/Ctrl + ,` | Subscript |
| `Cmd/Ctrl + Shift + U` | Underline |
| `Cmd/Ctrl + Shift + X` | Strikethrough |
| `Cmd/Ctrl + Alt + 1/2/3` | Heading 1/2/3 |
| `Cmd/Ctrl + Shift + 7` | Numbered list |
| `Cmd/Ctrl + Shift + 8` | Bullet list |
| `Cmd/Ctrl + Shift + 9` | Check list |
| `Cmd/Ctrl + Alt + C` | Code block |
| `Cmd/Ctrl + Shift + M` | Inline math |
| `Cmd/Ctrl + Alt + M` | Block math |
| `Cmd/Ctrl + U` | Upload |
| `Ctrl + M` | Toggle mode |
| `Cmd/Ctrl + Enter` | Submit form |
| `Ctrl + Shift + Q` | Blockquote |

`formatShortcut(key)` and `useFormattedShortcut(key)` convert shortcut strings to display-friendly labels (`⌘+B` on Mac, `ctrl+B` elsewhere).

#### `code-theme.js` — CodeThemePlugin

Listens to `useDarkMode` and dispatches `UPDATE_CODE_THEME_COMMAND` to re-register the Shiki highlighter when the site theme changes.

#### `append-value.js` — AppendValuePlugin

Appends the passed `appendValue` to the editor content. This is mainly used by Quote Replies that update `appendValue`.

#### `max-length.js` — MaxLengthPlugin

Enforces a character limit on the editor content. Truncates the text when we can't stop manual writing, e.g. copy/paste.

### Link Editor (`plugins/link/`)

A floating editor that appears when a link is selected in rich mode.

#### `index.js` — LinkEditorPlugin

Detects when the selection is on a `LinkNode` or `AutoLinkNode` and shows the floating editor. Updates position on scroll and resize (coalesced to one call per animation frame). Handles URL paste to create autolinks or wrap selected text in a link.

#### `editor.js` — LinkEditor Component

Two-state UI:
- **View mode:** displays the URL with edit and unlink buttons
- **Edit mode:** input field with confirm/cancel buttons

Auto-enters edit mode when a link has no URL. Positioned relative to the link element with viewport collision detection and fade animation. Escape key closes the editor.

### Toolbar (`plugins/toolbar/`)

#### `index.js` — ToolbarPlugin

Renders the formatting toolbar in rich mode. Updates toolbar state from the current selection. Includes:
- Block type dropdown (paragraph, headings, lists, code)
- Format buttons (bold, italic, quote, code, link)
- Additional formats dropdown (superscript, subscript, strikethrough)
- Inserts dropdown (math, inline math)
- Upload button

The toolbar is conditionally rendered — disabled in markdown mode.

#### `switch.js` — ModeSwitch

Tab interface to switch between markdown and rich mode. Registers `TOGGLE_MODE_COMMAND`.

### Other Plugins

#### `mentions.js` — MentionsPlugin

Autocomplete for `@user` and `~territory` mentions.

#### `upload.js` — UploadPlugin

Handles file uploads via `SN_UPLOAD_FILES_COMMAND`. Integrates with the S3 upload pipeline.

### Patches (`plugins/patch/`)

Browser-specific fixes:

- **`softkey-unborker.js`** — Android IME fix: suppresses composition events after delete to prevent "resurrected" text from `compositionend` replaying stale data.
- **`softkey-emptyguard.js`** — Android: keeps text nodes non-empty to prevent IME from losing its composing target, which causes typing to silently fail.
- **`next-link.js`** — Intercepts link clicks in the Reader for Next.js client-side navigation. Handles hash links (smooth scroll) and internal links (`router.push`) instead of full page reloads.

---

## Entry Points (`index.js`)

### `SNEditor`

Wraps `Editor` with `EditorModeProvider` and `ToolbarContextProvider`. Used by `components/form.js` for post/reply forms.

### `SNReader`

Read-only renderer for stored content. Dynamically imported with SSR disabled.

- **HTML fallback:** While the Lexical bundle loads, renders server-generated HTML via an `HTMLContext` provider so users see content immediately.
- **Debug mode:** When `?html` is in the URL query, renders the raw server HTML directly (bypasses Lexical entirely) for debugging server-side rendering.
- **Initialization:** Accepts `state` (serialized Lexical JSON from the `lexicalState` resolver) or `text` (raw markdown). Prefers `text` if provided — converts via `markdownToLexical()`. Falls back to parsing `state` via `editor.parseEditorState()`.
- **Extensions:** `RichTextExtension`, `TableExtension`, `CodeShikiSNExtension`, `AutoLinkExtension`, `GalleryExtension`, `MuteLexicalExtension` (allows DOM translators like Google Translate).
- **Plugins:** `CodeThemePlugin` (dark/light Shiki themes), `NextLinkPlugin` (client-side link navigation).

---

## Data Flow

### Write Path (editor → server)

```
User types in SNEditor
       │
       ├── Markdown mode:
       │     FormikBridgePlugin → $getMarkdown(editor) → $getTextContent() → formik.text (instant)
       │
       └── Rich mode:
             FormikBridgePlugin → $getMarkdown(editor) → $lexicalToMarkdown() → formik.text (debounced 500ms)
       │
       ▼ Form submission
       │
       ▼ API mutation receives plain markdown in `text`
       │
       ▼ Stored in DB as Item.text (markdown string)
```

### Read Path (server → reader)

```
Item.text (markdown from DB)
       │
       ▼ lexicalStateLoader.load({ text, context })
       │  prepareLexicalState():
       │    headless editor + ItemContext + AutoLink + Gallery
       │    markdownToLexical → $trimEmptyNodes → JSON.stringify
       │
       ├──▶ lexicalState field → SNReader (client hydration)
       │
       └──▶ html field → lexicalHTMLGenerator → SSR fallback + ?html debug
```

---

## useEditableCarousel

Defined in `components/carousel.js`, this hook is used by media nodes to conditionally enable carousel interactions.

```javascript
const carousel = useEditableCarousel(editable)
```

- Returns the carousel context (`addMedia`, `confirmMedia`, `showCarousel`) if the editor is **not editable** (read-only / reader mode).
- Returns `NOOP_CAROUSEL` if the editor **is editable**, preventing carousel interactions during editing.

This ensures clicking an image in the editor selects the node rather than opening the fullscreen carousel.
