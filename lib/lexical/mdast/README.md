# MDAST <-> Lexical

mdast-based markdown transformations for lexical

## the old [React-Markdown](https://github.com/remarkjs/react-markdown?tab=readme-ov-file#architecture) architecture

```
                                                           react-markdown
         +----------------------------------------------------------------------------------------------------------------+
         |                                                                                                                |
         |  +----------+        +----------------+        +---------------+       +----------------+       +------------+ |
         |  |          |        |                |        |               |       |                |       |            | |
markdown-+->+  remark  +-mdast->+ remark plugins +-mdast->+ remark-rehype +-hast->+ rehype plugins +-hast->+ components +-+->react elements
         |  |          |        |                |        |               |       |                |       |            | |
         |  +----------+        +----------------+        +---------------+       +----------------+       +------------+ |
         |                                                                                                                |
         +----------------------------------------------------------------------------------------------------------------+
```

Pipeline intended only for rendering Markdown to React

## the new **bi-directional** architecture

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
| `actions.addAndStepInto(lexicalNode)` | append node to parent, then recursively visit mdast children (if any) |
| `actions.appendInlineNode(lexicalNode)` | append inline node to parent, wrapping in paragraph if the parent is RootNode |
| `actions.visitChildren(mdastNode, lexicalParent)` | manually visit children |
| `actions.nextVisitor()` | skip this visitor, try the next matching one |
| `actions.addFormatting(format)` | add text formatting (bold, italic, etc.) |
| `actions.getParentFormatting()` | get inherited formatting from parent |

#### priority and nextVisitor

when multiple visitors match the same mdast type, we can use priority to control order:

```javascript
// high priority: check if link is an embed first
export const MdastEmbedFromLinkVisitor = {
  testNode: 'link',
  priority: 15,
  visitNode ({ mdastNode, actions }) {
    if (!isBareLink(mdastNode)) {
      actions.nextVisitor()  // not a raw link, try next visitor
      return
    }

    const embed = getEmbed(mdastNode.url)
    if (embed.provider) {
      const node = $createEmbedNode(...)
      actions.addAndStepInto(node)
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

transforms still run after parsing but before visitor traversal. here is where we can use Unist utilities to our advantage.

for example, the mentions transform leans on `mdast-util-find-and-replace`, which wraps all the `visit` boilerplate for us.
`findAndReplace` lets us search text node contents with regexes and split them into multiple nodes.

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

if we instead want to find existing nodes and manipulate the tree structure, Unist's `visit` is a better fit.
for example, the footnotes transform (`mdast/transforms/footnotes.js`) *visits* `footnoteDefinition` nodes and relocates them inside a `footnotesSection` node.

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

## adding custom bi-directional nodes

for nodes with custom syntax that doesn't exist in standard markdown (like `@mentions`), you need the provide the full round-trip:

```
import:  markdown → transform → custom MDAST → visitor → Lexical
export:  Lexical → visitor → custom MDAST → toMarkdown handler → markdown
```

### example: user mentions (@user)

**1. create the transform** (`transforms/mentions.js`)

transforms parse text patterns into custom MDAST nodes:

```javascript
import { findAndReplace } from 'mdast-util-find-and-replace'

const USER_MENTION = /some-regex/gi

export function mentionTransform (tree) {
  findAndReplace(tree, [
    [USER_MENTION, (_, name) => ({
      type: 'userMention',
      value: { name }
    })]
  ], { ignore: ['code', 'inlineCode'] })
}
```

**2. create import visitor** (`visitors/mentions.js`)

```javascript
import { $createUserMentionNode, $isUserMentionNode } from '@/lib/lexical/nodes/mentions'

export const MdastUserMentionVisitor = {
  testNode: 'userMention',
  visitNode ({ mdastNode, actions }) {
    const node = $createUserMentionNode({ name: mdastNode.value.name })
    actions.addAndStepInto(node)
  }
}
```

**3. create export visitor** (same file)

lexical -> custom MDAST

```javascript
export const LexicalUserMentionVisitor = {
  testLexicalNode: $isUserMentionNode,
  visitLexicalNode ({ lexicalNode, mdastParent, actions }) {
    actions.appendToParent(mdastParent, {
      type: 'userMention',
      value: { name: lexicalNode.getName() }
    })
  },
  mdastType: 'userMention',
  toMarkdown (node) {
    return `@${node.value.name}`
  }
}
```

to add a custom node to MDAST when going from Lexical to MDAST, we need to provide:
- `mdastType`: name of the custom node
- `toMarkdown` handler: the markdown string you want to return

**4. try it out**

normally we would need to create a `toMarkdown` extension, but `lexicalToMarkdown` already gathers every `toMarkdown` handlers via the `exportVisitors` (in this case `LexicalUserMentionVisitor`) and transforms it into an extension.

### when to use this pattern

use custom MDAST nodes when:
- the syntax doesn't map to standard MDAST types
- you want semantic information preserved in the MDAST tree
- you need the same representation in both directions

for simple cases where you just need markdown output, you can skip the custom type and emit a `text` node directly in the export visitor:

```javascript
// item mentions are created from bare links (see link.js)
// lexical -> mdast: outputs plain text URL
export const LexicalItemMentionVisitor = {
  testLexicalNode: $isItemMentionNode,
  visitLexicalNode ({ lexicalNode, mdastParent, actions }) {
    // export as plain text URL, not a link
    actions.appendToParent(mdastParent, {
      type: 'text',
      value: lexicalNode.getURL()
    })
  }
}
```

it is, anyway, recommended to map every custom Lexical node to a custom MDAST node. it'll allow us to manipulate the MDAST tree confidently, without extra-parsing in both directions.

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
