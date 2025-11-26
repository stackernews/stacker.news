The Lexical markdown regex-based transformers resulted in numerous bugs while trying to transform to and from a Lexical state.
MDAST provides a dead-simple way to map Lexical to Markdown (and vice versa).

***one of the problems***

In Lexical, a text node that is bold and superscript looks something like this:

```
TextNode {
  text: "some text"
  format: 65 // bold + superscript bitmask
}
```

Markdown instead:

`**<sup>some text</sup>**`

The canonical `lexical/markdown` way is to create a transformer that scans for TextNodes, gets the text formatting, and builds a string that can be similar to the markdown showed before.

The same transformer should also take care of the opposite transformation direction (this is where things get tricky).
The markdown text I showed before is something that `lexical/markdown` doesn't natively support: it can't handle multi-format combinations reliably and supporting HTML-only formats is chaotic.

Lexical tried to make it simpler, by creating multi-line, text-match, etc. types of transformers. The problem with this approach is maintenance, as this is very clearly a time-ticking bomb.

---

**MDAST**

Using MDAST as a canonical intermediate between Lexical and Markdown felt way safer and maintainable:

- Standardized: it follows the markdown spec
- Extensible: can implement new custom node types and we can persist custom node data between transformations
- Lossless: it's Lexical mapped to Markdown, not some kind of string interpretation.

#### how it works

Each transformer is an object with round-trip methods:
```javascript
{
  type: 'heading' // export lexical node type
  mdastType: 'heading', // import mdast node type
  priority: 0, // can have multiple heading type transformers orchestrated via priority
  toMdast(lexicalNode, visit), // lexical to mdast
  fromMdast(mdastNode, visit) // mdast to lexical
  toMarkdown(mdastNode, serialize) // mdast to markdown string
}
```

Example import flow (markdown to lexical) with the `userMention` custom micromark extension:

this text: `# hello @sox`
`parseMarkdownToMdast()`:
```javascript
{
  type: 'root',
  children: [{
    type: 'heading',
    depth: 1,
    children: [
      { type: 'text', value: 'hello ' },
      { type: 'userMention', value: { name: 'sox' } }
    ]
  }]
}
```

We can see that the markdown mdast parser recognized an heading with two children: `text` and `userMention`.

This is exactly what Lexical represents in its own JSON lexical state.
```
- HeadingNode('h1')
  - TextNode('hello ')
  - UserMentionNode({ name: 'sox' })
```

Example export flow (lexical to markdown)

Lexical:
```
- HeadingNode('h1')
  - TextNode('hello ')
  - UserMentionNode({ name: 'sox' })
```

`toMdast()`:
```javascript
{
  type: 'root',
  children: [{
    type: 'heading',
    depth: 1,
    children: [
      { type: 'text', value: 'hello ' },
      { type: 'userMention', value: { name: 'sox' } }
    ]
  }]
}
```

Now that we have the mdast version we can just serialize it into markdown

`serializeMdast()`: `# hello @sox`

---

### creating a custom type

Now that we have an extensible MDAST system we can create custom extensions for custom types.
Let's see what do we have to do to implement user mentions

The `prefixTokenizer(prefix, pattern, typeName)` creates a micromark tokenizer for prefix-based syntaxes.
A micromark extension will then just be:

```javascript
64: { // 64 is @
  tokenize: prefixTokenizer('@', /[a-zA-Z0-9_/]/, 'userMention')
}
```

And a mapping will look like:

```javascript
export const USER_MENTION = {
  type: 'user-mention',
  mdastType: 'userMention',
  toMdast: (node) => ({
    type: 'userMention',
    value: { name: node.getUserMentionName(), path: node.getPath() || '' }
  }),
  fromMdast: (node) => {
    if (node.type !== 'userMention') return null
    return $createUserMentionNode({ name: node.value.name, path: node.value.path || '' })
  },
  toMarkdown: (node) => `@${node.value.name}${node.value.path || ''}`
}
```