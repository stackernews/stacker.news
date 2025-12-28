# The Hitchhiker's Guide to Lexical: `integration`

Lexical is a web text-editor framework ...

## Overview

We're using Lexical to build a Markdown and Rich Text editor that supports lossless bi-directional conversions between the two aforementioned modes, via MDAST.

## structure

```
lib/lexical/
├── exts/           # editor extensions
├── mdast/          # Markdown AST import/export
├── nodes/          # custom Lexical nodes
├── server/         # SSR utilities
├── theme/          # editor theming
└── utils/          # shared utilities
```

This folder contains everything that is not React, for the exception of basic JSX calls to React components in the case of nodes that are React `DecoratorNode`s

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
Aims to provide lossless bi-directional conversions.

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

For example, we used `ElementNode` to create footnotes:
  - `FootnoteSectionNode`
    - parent container that groups footnote definitions
  - `FootnoteDefinitionNode`
    - parent container for the definition which will be a `TextNode`
  - `FootnoteBackrefNode`
    - parent container for the backref button which will be a `LinkNode`

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

TODO
