import { fromMarkdown } from 'mdast-util-from-markdown'
import { $createTextNode, $createParagraphNode, $isElementNode, $isRootNode } from 'lexical'
import { isParent } from '@/lib/lexical/mdast/shared'
import { MDAST_DEBUG } from '@/lib/constants'

export class MarkdownParseError extends Error {
  constructor (message, cause) {
    super(message)
    this.name = 'MarkdownParseError'
    this.cause = cause
  }
}

export class UnrecognizedMarkdownConstructError extends Error {
  constructor (message) {
    super(message)
    this.name = 'UnrecognizedMarkdownConstructError'
  }
}

function gatherMetadata (mdastNode) {
  const importsMap = new Map()
  if (mdastNode.type !== 'root') {
    return { importDeclarations: {} }
  }

  const importStatements = mdastNode.children
    .filter((n) => n.type === 'mdxjsEsm')
    .filter((n) => n.value.startsWith('import '))

  importStatements.forEach((imp) => {
    ;(imp.data?.estree?.body ?? []).forEach((declaration) => {
      if (declaration.type !== 'ImportDeclaration') {
        return
      }
      declaration.specifiers.forEach((specifier) => {
        importsMap.set(specifier.local.name, {
          source: `${declaration.source.value}`,
          defaultExport: specifier.type === 'ImportDefaultSpecifier'
        })
      })
    })
  })

  return { importDeclarations: Object.fromEntries(importsMap.entries()) }
}

// parse markdown string and import into a lexical tree
export function importMarkdownToLexical ({
  root,
  markdown,
  visitors,
  syntaxExtensions,
  mdastExtensions,
  mdastTransforms = [],
  splitInParagraphs = false,
  ...descriptors
}) {
  let mdastRoot

  // DEBUG: what are we importing?
  if (MDAST_DEBUG) {
    console.log('[MDAST->Lexical] Markdown to be imported', markdown)
  }

  try {
    mdastRoot = fromMarkdown(markdown, {
      extensions: syntaxExtensions,
      mdastExtensions
    })
  } catch (e) {
    if (e instanceof Error) {
      throw new MarkdownParseError(`Error parsing markdown: ${e.message}`, e)
    } else {
      throw new MarkdownParseError(`Error parsing markdown: ${e}`, e)
    }
  }

  // apply mdast transforms (e.g., mention detection)
  for (const transform of mdastTransforms) {
    transform(mdastRoot)
  }

  if (mdastRoot.children.length === 0) {
    mdastRoot.children.push({ type: 'paragraph', children: [] })
  }

  // NOTE: this has been commented out because
  // we don't need to add a paragraph at the end if we're not exposing an editable tree to the user
  // TODO: explore this on future Rich Text development
  // if (!splitInParagraphs && mdastRoot.children.at(-1)?.type !== 'paragraph') {
  //   mdastRoot.children.push({ type: 'paragraph', children: [] })
  // }

  // DEBUG: what is the resulting mdast tree?
  if (MDAST_DEBUG) {
    console.log('[MDAST->Lexical] MDAST tree to be imported', mdastRoot)
  }
  importMdastTreeToLexical({ root, mdastRoot, visitors, markdown, splitInParagraphs, ...descriptors })
}

// import an existing mdast tree into a lexical tree
export function importMdastTreeToLexical ({
  root,
  mdastRoot,
  visitors,
  markdown = '',
  splitInParagraphs = false,
  ...descriptors
}) {
  const formattingMap = new WeakMap()
  const styleMap = new WeakMap()
  const metaData = gatherMetadata(mdastRoot)

  function visitChildren (mdastNode, lexicalParent) {
    if (!isParent(mdastNode)) {
      throw new Error(`Attempting to visit children of a non-parent node of type "${mdastNode?.type ?? 'unknown'}"`)
    }
    mdastNode.children.forEach((child) => {
      visit(child, lexicalParent, mdastNode)
    })
  }

  function visit (mdastNode, lexicalParent, mdastParent, skipVisitors = null) {
    const visitor = visitors.find((visitor, index) => {
      if (skipVisitors?.has(index)) {
        return false
      }
      if (typeof visitor.testNode === 'string') {
        return visitor.testNode === mdastNode.type
      }
      return visitor.testNode(mdastNode, descriptors)
    })

    if (!visitor) {
      // extract original markdown using position offsets
      let textValue = ''
      if (markdown && mdastNode.position) {
        const { start, end } = mdastNode.position
        textValue = markdown.slice(start.offset, end.offset)
      }
      // log warning and create a text node for unrecognized constructs
      if (MDAST_DEBUG) {
        console.warn(
          '[mdast-to-lexical] Unrecognized markdown construct:', {
            type: mdastNode.type,
            node: mdastNode,
            markdown: textValue
          })
      }
      if (textValue) {
        const textNode = $createParagraphNode().append($createTextNode(textValue))
        lexicalParent.append(textNode)
      }
      return
    }

    visitor.visitNode({
      mdastNode,
      lexicalParent,
      mdastParent,
      descriptors,
      metaData,
      splitInParagraphs,
      actions: {
        visitChildren,
        nextVisitor () {
          visit(mdastNode, lexicalParent, mdastParent, (skipVisitors ?? new Set()).add(visitors.indexOf(visitor)))
        },
        addAndStepInto (lexicalNode) {
          lexicalParent.append(lexicalNode)
          // only element nodes can have children
          if (isParent(mdastNode) && $isElementNode(lexicalNode)) {
            // propagate parent formatting to current node so children can inherit it
            // this handles cases like **[link](url)**, the formatting is propagated to the TextNode inside the link
            if (!formattingMap.has(mdastNode)) {
              const parentFormat = formattingMap.get(mdastParent) ?? 0
              if (parentFormat) {
                formattingMap.set(mdastNode, parentFormat)
              }
            }
            visitChildren(mdastNode, lexicalNode)
          }
        },
        addFormatting (format, node) {
          if (!node) {
            if (isParent(mdastNode)) {
              node = mdastNode
            }
          }
          if (node) {
            formattingMap.set(node, format | (formattingMap.get(mdastParent) ?? 0))
          }
        },
        // only element or decorator nodes can be inserted to the root node,
        // in that case, wrap in paragraph before appending
        appendInlineNode (node) {
          if ($isRootNode(lexicalParent)) {
            const paragraph = $createParagraphNode().append(node)
            lexicalParent.append(paragraph)
          } else {
            lexicalParent.append(node)
          }
        },
        removeFormatting (format, node) {
          if (!node) {
            if (isParent(mdastNode)) {
              node = mdastNode
            }
          }
          if (node) {
            formattingMap.set(node, format ^ (formattingMap.get(mdastParent) ?? 0))
          }
        },
        getParentFormatting () {
          return formattingMap.get(mdastParent) ?? 0
        },
        addStyle (style, node) {
          if (!node) {
            if (isParent(mdastNode)) {
              node = mdastNode
            }
          }
          if (node) {
            styleMap.set(node, style)
          }
        },
        getParentStyle () {
          return styleMap.get(mdastParent) ?? ''
        }
      }
    })
  }

  visit(mdastRoot, root, null)
}
