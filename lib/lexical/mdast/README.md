# mdast4lexical

mdast-based markdown transformation for lexical

## bi-directional architecture

```
markdown string
     │
     ▼ (micromark + mdast-util-from-markdown)
mdast tree
     │
     ▼ (mdast transforms)
mdast tree (transformed)
     │
     ▼ (import visitors)
lexical nodes
     │
     ▼ (export visitors)
mdast tree
     │
     ▼ (mdast-util-to-markdown)
markdown string
```

## how to handle markdown transformations

```javascript
import { mentionTransform } from './transforms/mentions.js'

function setMarkdown (editor, markdown) {
  editor.update(() => {
    const root = $getRoot()
    root.clear()

    importMarkdownToLexical({
      root,
      markdown,
      visitors: importVisitors,
      syntaxExtensions: [],      // micromark extensions
      mdastExtensions: [],       // mdast-util extensions
      mdastTransforms: [mentionTransform]
    })
  })
}

function getMarkdown (editor) {
  return editor.getEditorState().read(() => {
    return exportMarkdownFromLexical({
      root: $getRoot(),
      visitors: exportVisitors,
      toMarkdownExtensions: [],
      toMarkdownOptions: {}
    })
  })
}
```

## visitors

visitors handle translations between mdast nodes and lexical nodes.  
each feature has two visitors:

- **import visitor**: mdast → lexical
- **export visitor**: lexical → mdast

### import visitors (mdast → lexical)

```javascript
import { $createHeadingNode } from '@lexical/rich-text'

export const MdastHeadingVisitor = {
  // match mdast nodes by type string
  testNode: 'heading',

  // optional priority (higher = checked first, default = 0)
  priority: 0,

  visitNode ({ mdastNode, lexicalParent, actions }) {
    const tag = `h${mdastNode.depth}`
    actions.addAndStepInto($createHeadingNode(tag))
  }
}
```

#### testNode options

```javascript
// match by type string
testNode: 'heading'

// or match by function for precise detection
testNode: (node) => node.type === 'html' && node.value === tag
```

#### actions available in visitNode

| action | description |
|--------|-------------|
| `actions.addAndStepInto(lexicalNode)` | append node to parent, then recursively visit mdast children |
| `actions.visitChildren(mdastNode, lexicalParent)` | manually visit children |
| `actions.nextVisitor()` | skip this visitor, try the next matching one |
| `actions.addFormatting(format)` | add text formatting (bold, italic, etc.) |
| `actions.getParentFormatting()` | get inherited formatting from parent |

#### element nodes vs decorator nodes

**element nodes** (have children): use `actions.addAndStepInto()`
```javascript
// paragraph, heading, list, quote, etc.
visitNode ({ mdastNode, actions }) {
  actions.addAndStepInto($createParagraphNode())
}
```

**decorator nodes** (leaf nodes, no children): append directly
```javascript
// embed, media, mentions, etc.
visitNode ({ mdastNode, lexicalParent }) {
  const node = $createEmbedNode(...)
  lexicalParent.append(node)
}
```

#### priority and nextVisitor

when multiple visitors match the same mdast type, we can use priority to control order:

```javascript
// high priority: check if link is an embed first
export const MdastEmbedFromLinkVisitor = {
  testNode: 'link',
  priority: 15,
  visitNode ({ mdastNode, lexicalParent, actions }) {
    if (!isBareLink(mdastNode)) {
      actions.nextVisitor()  // not a raw link, try next visitor
      return
    }

    const embed = getEmbed(mdastNode.url)
    if (embed.provider) {
      const node = $createEmbedNode(...)
      lexicalParent.append(node)
      return
    }

    actions.nextVisitor() // not an embed, try next visitor
  }
}

// default priority: fallback to regular link
export const MdastLinkVisitor = {
  testNode: 'link',
  // priority: 0 (default)
  visitNode ({ mdastNode, actions }) {
    actions.addAndStepInto($createLinkNode(mdastNode.url))
  }
}
```

### export visitors (lexical → mdast)

```javascript
import { $isHeadingNode } from '@lexical/rich-text'

export const LexicalHeadingVisitor = {
  // match lexical nodes by predicate function
  testLexicalNode: $isHeadingNode,

  visitLexicalNode ({ lexicalNode, actions }) {
    const depth = parseInt(lexicalNode.getTag().slice(1))
    actions.addAndStepInto('heading', { depth })
  }
}
```

#### actions available in visitLexicalNode

| action | description |
|--------|-------------|
| `actions.addAndStepInto(type, props)` | create mdast node, append to parent, visit children |
| `actions.appendToParent(mdastParent, node)` | append mdast node directly (for leaf nodes) |

#### export examples

**element nodes**: use `addAndStepInto`
```javascript
export const LexicalParagraphVisitor = {
  testLexicalNode: $isParagraphNode,
  visitLexicalNode ({ actions }) {
    actions.addAndStepInto('paragraph')
  }
}
```

**leaf/decorator nodes**: use `appendToParent`
```javascript
export const LexicalEmbedVisitor = {
  testLexicalNode: $isEmbedNode,
  visitLexicalNode ({ lexicalNode, mdastParent, actions }) {
    // output plain text url
    actions.appendToParent(mdastParent, {
      type: 'text',
      value: lexicalNode.getSrc()
    })
  }
}
```

## mdast transforms

transforms still run after parsing but before visitor traversal. we now lean on `mdast-util-find-and-replace`, which wraps all the `visit` boilerplate for us. it keeps the code small while still letting us ignore specific node types (code blocks, inline code, etc.) and emit custom nodes.

### example: mentions with `findAndReplace`

```javascript
import { findAndReplace } from 'mdast-util-find-and-replace'

const USER = /\B@[a-z0-9_]+(?:\/[a-z0-9_/]+)?/gi
const TERRITORY = /~[a-z][\w_]+/gi

export function mentionTransform (tree) {
  findAndReplace(
    tree,
    [
      [
        USER,
        (value) => {
          const [name, ...pathParts] = value.slice(1).split('/')
          return {
            type: 'userMention',
            value: { name, path: pathParts.length ? '/' + pathParts.join('/') : '' }
          }
        }
      ],
      [
        TERRITORY,
        (value) => ({
          type: 'territoryMention',
          value: value.slice(1)
        })
      ]
    ],
    { ignore: ['code', 'inlineCode'] }
  )
}
```

and wire it up:

```javascript
import { mentionTransform } from './transforms/mentions'

importMarkdownToLexical({
  root,
  markdown,
  visitors: importVisitors,
  mdastTransforms: [mentionTransform]
})
```

this is extremely similar to what we do with rehypeSN (lib/rehype-sn.js):
1. scan text nodes
2. inject custom nodes

the key difference is that we're not working with an HTML (HAST) pipeline, instead we're running this post-processing on the MDAST tree, leaning on a well-established helper (findAndReplace) without having to do Unist visits by hand.

## adding new features

### example: adding table support

1. create `visitors/table.js`:

```javascript
import { $createTableNode, $isTableNode } from '@lexical/table'
import { $createTableRowNode, $isTableRowNode } from '@lexical/table'
import { $createTableCellNode, $isTableCellNode } from '@lexical/table'

// mdast → lexical
export const MdastTableVisitor = {
  testNode: 'table',
  visitNode ({ actions }) {
    actions.addAndStepInto($createTableNode())
  }
}

export const MdastTableRowVisitor = {
  testNode: 'tableRow',
  visitNode ({ actions }) {
    actions.addAndStepInto($createTableRowNode())
  }
}

export const MdastTableCellVisitor = {
  testNode: 'tableCell',
  visitNode ({ actions }) {
    actions.addAndStepInto($createTableCellNode())
  }
}

// lexical → mdast
export const LexicalTableVisitor = {
  testLexicalNode: $isTableNode,
  visitLexicalNode ({ actions }) {
    actions.addAndStepInto('table')
  }
}

export const LexicalTableRowVisitor = {
  testLexicalNode: $isTableRowNode,
  visitLexicalNode ({ actions }) {
    actions.addAndStepInto('tableRow')
  }
}

export const LexicalTableCellVisitor = {
  testLexicalNode: $isTableCellNode,
  visitLexicalNode ({ actions }) {
    actions.addAndStepInto('tableCell')
  }
}
```

2. add to `visitors/index.js`:

```javascript
import {
  MdastTableVisitor,
  MdastTableRowVisitor,
  MdastTableCellVisitor,
  LexicalTableVisitor,
  LexicalTableRowVisitor,
  LexicalTableCellVisitor
} from './table.js'

export const importVisitors = [
  // ... existing
  MdastTableVisitor,
  MdastTableRowVisitor,
  MdastTableCellVisitor
]

export const exportVisitors = [
  // ... existing
  LexicalTableVisitor,
  LexicalTableRowVisitor,
  LexicalTableCellVisitor
]
```

3. add micromark/mdast extensions for gfm tables:

```javascript
import { gfmTable } from 'micromark-extension-gfm-table'
import { gfmTableFromMarkdown } from 'mdast-util-gfm-table'

importMarkdownToLexical({
  // ...
  syntaxExtensions: [gfmTable()],
  mdastExtensions: [gfmTableFromMarkdown()]
})
```

## file structure

```
lib/lexical/mdast/
  index.js                      # main exports
  import.js    # mdast → lexical core
  export.js  # lexical → mdast core
  format-constants.js            # text format flags (bold, italic, etc.)
  visitors/
    index.js                    # visitor arrays
    root.js                     # root visitors
    paragraph.js                # paragraph visitors
    text.js                     # text + formatting visitors
    linebreak.js                # linebreak visitors
    formatting.js               # bold, italic, strikethrough, etc.
    heading.js                  # heading visitors
    link.js                     # link, embed, media, image visitors
    quote.js                    # blockquote visitors
    list.js                     # list + list item visitors
    code.js                     # code block visitors
    horizontal-rule.js          # horizontal rule visitors
    mentions.js                 # user, territory, item mention visitors
  transforms/
    index.js                    # transform exports
    mentions.js                 # @user and ~territory transform
```

## some debugging

### log the mdast tree

```javascript
importMarkdownToLexical({
  // ...
  mdastTransforms: [
    (tree) => console.log('mdast:', JSON.stringify(tree, null, 2))
  ]
})
```

### handle unknown node types

if you see `UnrecognizedMarkdownConstructError`, add a visitor for that mdast type:

```javascript
// check what type is failing
mdastTransforms: [
  (tree) => {
    visit(tree, (node) => console.log(node.type))
  }
]
```

## infos

MIT - this system is based on code from MDXEditor
