# The Stacker News Editor: `integration`

Lexical is a web text-editor framework ...

## Overview

We're using Lexical to build a Markdown and Rich Text editor that round-trips between the two aforementioned modes via MDAST.
Most constructs survive the round-trip, but a few transforms are intentionally lossy or normalizing, such as table alignment export, misleading-link normalization, and footnote backref stripping.

## structure

```
lib/lexical/
├── headless.js     # createSNHeadlessEditor (SN headless editor factory)
├── commands/       # formatting, links, math commands
├── exts/           # editor extensions
├── mdast/          # Markdown AST import/export
├── nodes/          # custom Lexical nodes
│   ├── index.js              # DefaultNodes array (all registered nodes)
│   ├── utils.js              # node helpers ($replaceNodeWithLink, $isUnwritable)
│   ├── content/
│   │   ├── media.jsx         # MediaNode (images/videos)
│   │   ├── embed.jsx         # EmbedNode (YouTube, Twitter, etc.)
│   │   ├── gallery.jsx       # GalleryNode (adjacent media grouping)
│   │   └── toc.jsx           # TableOfContentsNode
│   ├── decorative/
│   │   ├── mentions/
│   │   │   ├── index.js      # mention exports
│   │   │   ├── user.jsx      # UserMentionNode (@user)
│   │   │   ├── territory.jsx # TerritoryMentionNode (~territory)
│   │   │   └── item.jsx      # ItemMentionNode (stacker.news/items/123)
│   │   └── footnote/
│   │       ├── index.js      # footnote exports
│   │       ├── section.jsx   # FootnotesSectionNode
│   │       ├── definition.jsx# FootnoteDefinitionNode
│   │       ├── reference.jsx # FootnoteReferenceNode
│   │       └── backref.jsx   # FootnoteBackrefNode
│   ├── formatting/
│   │   └── math.jsx          # MathNode (inline/block equations)
│   └── misc/
│       └── heading.jsx       # SNHeadingNode (HeadingNode + slug anchors)
├── server/         # SSR utilities
├── theme/          # editor theming
└── utils/          # shared utilities
```

This folder contains everything that is not React, for the exception of basic JSX calls to React components in the case of nodes that are React `DecoratorNode`s

---

## Headless Editor (`headless.js`)

Factory for creating a headless Lexical editor with SN defaults.
Used by the server pipeline (`interpolator.js`, `html.js`). The client-side transformer bridge builds its own detached editor in `useHeadlessBridge()` via `buildEditorFromExtensions()`.

```javascript
import { createSNHeadlessEditor } from '@/lib/lexical/headless'

const editor = createSNHeadlessEditor({
  namespace: 'snSSR',   // default
  theme: DefaultTheme,  // default
  nodes: DefaultNodes,  // default
  onError: console.error
})
```

---

## Commands (`commands/`)

Mode-aware formatting commands that work in both markdown and rich mode. Each command detects the current mode via `isMarkdownMode(editor)` (checks `editor._config.namespace === 'sn-markdown'`) and dispatches accordingly.

```
commands/
├── utils.js                # isMarkdownMode, $findTopLevelElement, $selectConsecutiveParagraphs, getSelectedNode
├── links.js                # SN_TOGGLE_LINK_COMMAND
├── math.js                 # SN_INSERT_MATH_COMMAND
└── formatting/
    ├── format.js            # SN_FORMAT_COMMAND (bold, italic, code, etc.)
    ├── blocks.js            # SN_FORMAT_BLOCK_COMMAND (headings, lists, quotes, code blocks)
    ├── markdown.js          # MD_FORMAT_COMMAND, MD_INSERT_BLOCK_COMMAND (direct markdown syntax insertion)
    └── utils.js             # $snHasLink, $snGetElementFormat, $snGetBlockType
```

### Mode Behavior

| Mode | Text Formatting | Block Formatting |
|------|-----------------|------------------|
| **Rich** | `FORMAT_TEXT_COMMAND` / `FORMAT_ELEMENT_COMMAND` | Direct Lexical node manipulation |
| **Markdown (with selection)** | `USE_TRANSFORMER_BRIDGE` — round-trips through a headless editor | `USE_TRANSFORMER_BRIDGE` via `$selectConsecutiveParagraphs()` |
| **Markdown (empty selection)** | `MD_FORMAT_COMMAND` — wraps cursor position with syntax markers (`**`, `*`, etc.) | `MD_INSERT_BLOCK_COMMAND` — prefixes lines (`# `, `> `, `- `) |

All commands are registered centrally via `FormattingCommandsExtension` (see extensions).

---

## Extensions (`exts/`)

[Lexical Extensions](https://lexical.dev/docs/extensions/defining-extensions) are a novel convention to add configuration and behavior to a Lexical editor in a framework-independent manner.
It's a plain JavaScript object based on the LexicalExtension interface, its properties are the following:

**Editor configuration**

- `name`: **required**
- `html`
  - can override HTML import/export
- `nodes`
  - can register or override nodes
- `theme`
  - can specify CSS classes to be used for nodes

**Extension dependencies**

- [`dependencies`](https://lexical.dev/docs/extensions/defining-extensions#dependencies)
  - an array of **required** extensions by reference, there must not be any circular dependency
    - we can also configure a dependency by calling it via `configExtension`
- [`peerDependencies`](https://lexical.dev/docs/extensions/peer-dependencies)
  - an array of **optional** extensions by ***name***, they're not requirements, but specifying them allows the extension to find them at runtime and override configuration for them if they're build with the editor.
- [`conflictsWith`](https://lexical.dev/docs/extensions/defining-extensions#conflictswith)
  - an array of extensions by ***name*** that are known to conflict with the extension, useful for helpful errors

**Extension phases (configuration and behavior)**

- [`config`](https://lexical.dev/docs/extensions/defining-extensions#config)
  - is an object that is the default configuration of the extension, properties of this object can be overridden by other extensions or the editor primarily via `configExtension`
    - NOTE: the `config` phase happens before the editor is constructed, it is used in later phases to build init and/or output
- [`mergeConfig`](https://lexical.dev/docs/extensions/defining-extensions#mergeconfig)
- [`init`](https://lexical.dev/docs/extensions/defining-extensions#init)
  - this phase happens **before** the editor is constructed, but after **all** extensions are configured; the result of this phase is available in later phases.
    - it's rarely needed, and considered an advanced use case.
- [`build`](https://lexical.dev/docs/extensions/defining-extensions#build)
  - this phase happens **before** the editor is constructed ***but after*** `config` and `init`
    - specifically useful when using Preact signals so that the behavior of the extension can be modified at runtime (for example, disabling itself). [More infos here](https://lexical.dev/docs/extensions/signals)
      - returns `output` and is available for later phases, this is how extensions provide functionality to each other and to the nodes we declared.
- [`register`](https://lexical.dev/docs/extensions/defining-extensions#register)
  - this phase happens **after** the editor has been constructed, this is where we'll register any commands, listeners, etc. that the extension needs. It can use the result of `init` or `build` via `state.getInit()` and `state.getOutput()`
    - this is the most common phase, we use it to replace React-based plugins that don't need React at all.
- [`afterRegistration`](https://lexical.dev/docs/extensions/defining-extensions#afterregistration)
  - like `register` but this phase happens **after `register` of every extension** has been called and **after** the editor state has been applied to the editor.

**Informations about SN's extensions are available in `lib/lexical/exts/README.md`**

---

## MDAST (`mdast/`)

Handles conversion between Markdown and Lexical by mapping the Markdown AST structure to the Lexical Editor State structure.  
Targets stable Markdown <-> Lexical round-trips while allowing a few deliberate normalizations and lossy edge cases where the underlying models do not match exactly.

**Informations about MDAST are available in `lib/lexical/mdast/README.md`**

---

## Nodes (`nodes/`)

> Nodes are a core concept in Lexical. Not only do they form the visual editor view, as part of the `EditorState`, but they also represent the underlying data model for what is stored in the editor at any given time.

Lexical has a single core based node, called **`LexicalNode`** that is extended internally to create Lexical's five base nodes:

- `RootNode`
- `LineBreakNode`
- `ElementNode` -> can be extended
- `TextNode` -> can be extended
- `DecoratorNode` -> can be extended

For the purposes of this README, we're very interested in extending **ElementNode** and **DecoratorNode**

### [`ElementNode`](https://lexical.dev/docs/concepts/nodes#elementnode)

Used as parent for other nodes, can be block level (like a `ParagraphNode`) or inline (`LinkNode`). Has various methods which define its behavior that can be overridden (`isInline` for example)

For example, we use `ElementNode` to model footnotes:
  - `FootnoteSectionNode`
    - parent container that groups footnote definitions
  - `FootnoteDefinitionNode`
    - parent container for a full footnote body (paragraphs, text, and the injected backref)
  - `FootnoteBackrefNode`
    - inline back-reference anchor appended to the definition during the footnote mdast transform

### [`DecoratorNode`](https://lexical.dev/docs/concepts/nodes#decoratornode)

It's a wrapper node to insert components inside the editor. In our case, React components.  
It's the only way to render React with nodes, and it's at the core of many of our custom nodes.

For example, we used `DecoratorNode` to create `MediaNode`.

**`decorate ()`**

When Lexical has to render a DecoratorNode, it calls `decorate()`

Here's `MediaNode`'s `decorate()` function:

```javascript
  decorate () {
    const MediaComponent = require('@/components/editor/nodes/media').default
    return (
      <MediaComponent
        src={this.__src}
        srcSet={$getState(this, srcSetState)}
        bestResSrc={$getState(this, bestResSrcState)}
        title={this.__title}
        alt={this.__alt}
        kind={$getState(this, kindState)}
        status={$getState(this, statusState)}
        width={$getState(this, widthState)}
        height={$getState(this, heightState)}
        maxWidth={this.__maxWidth}
        autolink={this.__autolink}
        nodeKey={this.getKey()}
      />
    )
  }
```

We're passing the `MediaNode` internal values and states as props to `MediaComponent`.

**note**

Make sure to implement a `getTextContent()` function for stuff that is displayed as text, such as `UserMentionNode`.

Lexical copy/paste handlers need to know what's the plain text equivalent of a `DecoratorNode`.

### Requirements

To create a node, we **must** provide a way to:

- export the node to HTML: `exportDOM`
- import a node from HTML: `importDOM`
    - with a `$convertSomeNodeElement` function that takes the HTML attributes and creates a Lexical Node with them
- export the node to JSON: `exportJSON`
- import the node from JSON: `importJSON`
- clone the node (e.g. moving): `clone`
- create the DOM: `createDOM`
    - or just the container for `DecoratorNode`'s `decorate()`
- if it's a `DecoratorNode` we also must provide the `decorate()` function.
    - the node extension has to be `.jsx` since this will feature some JSX, and our worker doesn't handle JSX in `.js` files.
    - since this will feature React components with `.js` extension, it is imperative to import them inside the decorate function and not top-level.

And it is recommended to provide the helpers:
- `$createSomeNode`
- `$isSomeNode`

### Custom SN Nodes

#### Content Nodes

- **`MediaNode`** (`content/media.jsx`) — images and videos. Extends `DecoratorNode`. Managed by `AutoLinkExtension` (creates from URLs) and `ItemContextExtension` (applies imgproxy srcSets, dimensions). Uses extension states (`srcSetState`, `bestResSrcState`, `kindState`, etc.) for server-injected properties.
- **`EmbedNode`** (`content/embed.jsx`) — third-party embeds (YouTube, Twitter, Nostr, etc.). Extends `DecoratorBlockNode`. Stores `provider`, `src`, `id`, and `meta`. Created by `AutoLinkExtension` when a standalone URL matches an embed provider.
- **`GalleryNode`** (`content/gallery.jsx`) — groups adjacent media into a gallery. Extends `ElementNode`. Created and merged automatically by `GalleryExtension` when adjacent media-only paragraphs and/or galleries are detected, then unwrapped again if the result contains only a single media node.
- **`TableOfContentsNode`** (`content/toc.jsx`) — renders a navigable table of contents from document headings.

#### Decorative Nodes

- **`UserMentionNode`** (`decorative/mentions/user.jsx`) — `@user` mentions, optionally with a `/path`. Extends `DecoratorNode`. Renders the mention text itself (`@name` plus optional path) as a Next.js link/popover and provides `getTextContent()` for copy/paste.
- **`TerritoryMentionNode`** (`decorative/mentions/territory.jsx`) — `~territory` mentions. Same pattern as `UserMentionNode`, without path support.
- **`ItemMentionNode`** (`decorative/mentions/item.jsx`) — internal item links (e.g. `stacker.news/items/123`). Created by `AutoLinkExtension` for bare internal URLs and by the mdast import visitors for markdown links. Exports as a markdown link when it carries custom text, otherwise as a plain text URL.
- **`FootnoteReferenceNode`** (`decorative/footnote/reference.jsx`) — inline footnote reference marker (e.g. `[^1]`).
- **`FootnoteDefinitionNode`** (`decorative/footnote/definition.jsx`) — footnote definition container for the visited child blocks.
- **`FootnotesSectionNode`** (`decorative/footnote/section.jsx`) — container that groups all footnote definitions at the end of the document.
- **`FootnoteBackrefNode`** (`decorative/footnote/backref.jsx`) — display-only back-reference anchor from a footnote definition back to its reference in the text. It is injected during mdast import and intentionally omitted on markdown export.

#### Formatting Nodes

- **`MathNode`** (`formatting/math.jsx`) — inline and block math equations. Extends `DecoratorNode`. Stores `math` (LaTeX string) and `inline` (boolean). Rendered via KaTeX in the editor component.

#### Misc Nodes

- **`SNHeadingNode`** (`misc/heading.jsx`) — extends Lexical's `HeadingNode` with slug-based anchor IDs. Replaces the built-in `HeadingNode` via the node replacement API so all headings get slugs. In read-only mode, prepends an anchor link (`<a class="sn-heading__link">`) for shareable heading URLs.

### `nodes/index.js` — DefaultNodes

Pre-assembled array of all registered nodes. Includes built-in Lexical nodes (`ListNode`, `QuoteNode`, `CodeNode`, `TableNode`, etc.) and all custom SN nodes. `SNHeadingNode` replaces `HeadingNode` via `{ replace: HeadingNode, with: ..., withKlass: SNHeadingNode }`.

### `nodes/utils.js` — Node Helpers

| Function | Description |
|---|---|
| `$replaceNodeWithLink(node, url)` | Replaces a node with a `LinkNode` wrapping the URL. Handles both paragraph-level and root-level placement. |
| `$isUnwritable(node)` | Returns `true` for any `DecoratorNode`, or for an `ElementNode` whose children are all decorator nodes. Used by `DecoratorClickZonesExtension`. |
| `$debugNodeToJSON(node, depth?)` | Debug utility: recursively exports a node and its children to a JSON object. |

---

## Server (`server/`)

Server-side rendering and processing utilities, more informations can be found in `lib/lexical/server/README.md`

---

## Theme (`theme/`)

A theme in Lexical is an object that maps node types to CSS classes.  
CSS modules *can* be used, but it is not recommended as they locally scope CSS by automatically creating a unique class name, breaking a possible future support for independent HTML exports.

This being said, CSS modules are still used for the Editor and plugins UI.

- `styles/text.scss` -> Lexical nodes and text rendering
    - `lib/lexical/theme/index.js` -> nodes<->CSS classes map
- `lib/lexical/theme/editor.module.css` -> Editor and plugins UI.

---

## Utilities (`utils/`)

Shared, framework-independent helpers used across both modes and by the server.

### `utils/index.js` — Markdown Text Helpers

Low-level functions for working with the editor as plain markdown text. Used by markdown mode, the local draft plugin, and Formik sync.

| Function | Description |
|---|---|
| `$getTextContent(trimWhitespace?)` | Gets the text content of the editor with controlled newlines |
| `$isTextEmpty()` | Checks if the editor content is empty |
| `$setText(value)` | Clears the editor and initializes with markdown text |
| `$insertText(text, trim?, cursor?)` | Inserts plain text at the current selection |
| `$appendMarkdown(markdown, trim?, spacing?)` | Appends markdown to the root |
| `$getNodesFromText(text, trim?)` | Parses plain text to Lexical paragraph nodes |
| `$insertTextAtSelection(text, spacing?, force?)` | Inserts text or TextNode with optional spacing |
| `$trimEmptyNodes()` | Removes empty nodes from the start and end of the root |
| `$moveSelection(selection, anchorDist, focusDist?)` | Moves selection by a given distance |
| `$getMarkdown(editor, trimWhitespace?)` | Mode-aware markdown extraction: calls `$lexicalToMarkdown()` in rich mode, `$getTextContent()` in markdown mode. Used by `FormikBridgePlugin` to sync with Formik. |

### `utils/mdast.js` — MDAST Bridge

Provides the conversion functions between markdown strings and Lexical nodes via the MDAST pipeline. This is the core of the bi-directional editing system.

```javascript
import { $markdownToLexical, $lexicalToMarkdown } from '@/lib/lexical/utils/mdast'
```

**`$markdownToLexical(markdown, { splitInParagraphs?, append? })`**

Converts a markdown string to Lexical nodes. By default, clears the root first; pass `append: true` to append instead. Parses via micromark + mdast, applies transforms (mentions, nostr, links, footnotes, TOC), then visits the tree to create Lexical nodes.

Syntax extensions: GFM (tables, strikethrough, etc.) and math. Block math uses fenced `$$` blocks, and inline math is also supported, but `singleDollarTextMath: false` means inline syntax must use the double-dollar form.

**`$lexicalToMarkdown(transformerBridge?)`**

Converts the current Lexical editor state to a markdown string. When `transformerBridge` is `true`, bypasses markdown escaping to preserve raw text for editor round-trips (used by the transformer bridge plugin).

Custom `toMarkdown` handlers prevent autolink syntax (`<url>`) and always output `[text](url)` format.

**`removeZeroWidthSpace(text)`** — strips `U+200B` characters some browsers insert.

### `utils/position.js` — Floating Element Positioning

Used by the link editor (and potentially other floating UI) to position elements relative to a target with viewport collision detection.

```javascript
import { setFloatingElemPosition } from '@/lib/lexical/utils/position'

setFloatingElemPosition({
  targetRect,        // DOMRect to position near
  floatingElem,      // element to position
  anchorElem,        // anchor for relative offsets
  verticalGap: 10,   // pixels above target
  horizontalOffset: 5,
  fade: false        // fade out before repositioning
})
```

Collision detection: if the element would overflow the top of the editor, it flips below the target. If it overflows the right edge, it snaps to the right boundary.

### `utils/dom.js` — DOM Helpers

`getDragSelection(event)` — resolves a drag event to a DOM `Range`, handling both `caretRangeFromPoint` (Chrome) and `rangeParent` (Firefox) APIs.

### `utils/toc.js` — Table of Contents

Extracts headings from the document and builds a nested structure for the TOC node.

| Function | Description |
|---|---|
| `$extractHeadingsFromRoot()` | Collects all `SNHeadingNode` instances with text, depth, and slug |
| `buildNestedTocStructure(headings)` | Converts flat headings array to nested parent-children structure |
| `buildHtmlFromStructure(items)` | Recursively builds `<ul>/<li>/<a>` DOM elements from the structure |
