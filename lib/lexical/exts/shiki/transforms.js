import {
  $getNodeByKey,
  $getSelection,
  $isRangeSelection,
  $isLineBreakNode,
  $isTabNode,
  $isTextNode,
  $createTextNode,
  $onUpdate
} from 'lexical'
import { $isCodeNode, $isCodeHighlightNode } from '@lexical/code-core'
import {
  isCodeLanguageLoaded,
  isCodeThemeLoaded,
  loadCodeLanguage,
  loadCodeTheme
} from '@/lib/lexical/exts/shiki/highlighter'

// updates the data-gutter attribute on the code element with one line number
// per line. only runs when the children count changes (caching avoids touching
// the DOM on every keystroke within a line).
export function updateCodeGutter (node, editor) {
  const codeElement = editor.getElementByKey(node.getKey())
  if (codeElement === null) return
  const children = node.getChildren()
  const childrenLength = children.length
  if (childrenLength === codeElement.__cachedChildrenLength) return
  codeElement.__cachedChildrenLength = childrenLength
  let gutter = '1'
  let count = 1
  for (let i = 0; i < childrenLength; i++) {
    if ($isLineBreakNode(children[i])) {
      gutter += '\n' + ++count
    }
  }
  codeElement.setAttribute('data-gutter', gutter)
}

// returns true when the selection's anchor and focus live in the same CodeNode
export function $isSelectionInCode (selection) {
  if (!$isRangeSelection(selection)) return false
  const anchorNode = selection.anchor.getNode()
  const maybeAnchorCodeNode = $isCodeNode(anchorNode) ? anchorNode : anchorNode.getParent()
  const focusNode = selection.focus.getNode()
  const maybeFocusCodeNode = $isCodeNode(focusNode) ? focusNode : focusNode.getParent()
  return $isCodeNode(maybeAnchorCodeNode) && maybeAnchorCodeNode.is(maybeFocusCodeNode)
}

// TextNode transform: if the node lives inside a CodeNode, run the code-block
// highlight pass on the parent. If it's a stray CodeHighlightNode (e.g. its
// parent CodeNode was converted to a paragraph), demote it back to a TextNode.
export function $textNodeTransform (editor, tokenizer, transformState, node) {
  const parentNode = node.getParent()
  if ($isCodeNode(parentNode)) {
    $codeNodeTransform(editor, tokenizer, transformState, parentNode)
  } else if ($isCodeHighlightNode(node)) {
    node.replace($createTextNode(node.__text))
  }
}

// CodeNode transform: ensure language/theme are loaded (kick off dynamic
// imports if not), tokenize the content, and splice the minimal diff into
// the existing children while keeping the caret in place.
export function $codeNodeTransform (editor, tokenizer, transformState, node) {
  const nodeKey = node.getKey()
  const { nodesCurrentlyHighlighting } = transformState

  // fill in defaults the first time we see this node
  let language = node.getLanguage()
  if (!language) {
    language = tokenizer.defaultLanguage
    node.setLanguage(language)
  }
  let theme = node.getTheme()
  if (!theme) {
    theme = tokenizer.defaultTheme
    node.setTheme(theme)
  }

  // bail out and wait for the dynamic import; loadCodeXxx will dirty the node
  // again when the grammar/theme arrives, re-running this transform
  let inFlight = false
  if (!isCodeThemeLoaded(theme)) {
    loadCodeTheme(theme, editor, nodeKey)
    inFlight = true
  }
  if (isCodeLanguageLoaded(language)) {
    if (!node.getIsSyntaxHighlightSupported()) node.setIsSyntaxHighlightSupported(true)
  } else {
    if (node.getIsSyntaxHighlightSupported()) node.setIsSyntaxHighlightSupported(false)
    loadCodeLanguage(language, editor, nodeKey)
    inFlight = true
  }
  if (inFlight) return

  // guard against re-entry while we're already painting this CodeNode in this
  // editor update (transforms can fire multiple times per update)
  if (nodesCurrentlyHighlighting.has(nodeKey)) return
  nodesCurrentlyHighlighting.add(nodeKey)
  if (!transformState.didTransform) {
    transformState.didTransform = true
    $onUpdate(() => {
      transformState.didTransform = false
      nodesCurrentlyHighlighting.clear()
    })
  }

  $updateAndRetainSelection(nodeKey, () => {
    const currentNode = $getNodeByKey(nodeKey)
    if (!$isCodeNode(currentNode) || !currentNode.isAttached()) return false
    const lang = currentNode.getLanguage() || tokenizer.defaultLanguage
    const highlightNodes = tokenizer.$tokenize(currentNode, lang)
    const { from, to, nodesForReplacement } = getDiffRange(currentNode.getChildren(), highlightNodes)
    if (from !== to || nodesForReplacement.length) {
      node.splice(from, to - from, nodesForReplacement)
      return true
    }
    return false
  })
}

// runs updateFn but restores the caret to roughly the same character offset
// after the splice, so typing inside a code block doesn't reset the cursor
function $updateAndRetainSelection (nodeKey, updateFn) {
  const node = $getNodeByKey(nodeKey)
  if (!$isCodeNode(node) || !node.isAttached()) return
  const selection = $getSelection()
  if (!$isRangeSelection(selection)) {
    updateFn()
    return
  }
  const anchor = selection.anchor
  const anchorOffset = anchor.offset
  const isNewLineAnchor = anchor.type === 'element' && $isLineBreakNode(node.getChildAtIndex(anchor.offset - 1))
  let textOffset = 0

  // sum text length of all previous siblings + anchor's own offset
  if (!isNewLineAnchor) {
    const anchorNode = anchor.getNode()
    textOffset = anchorOffset + anchorNode.getPreviousSiblings().reduce(
      (offset, sibling) => offset + sibling.getTextContentSize(),
      0
    )
  }
  const hasChanges = updateFn()
  if (!hasChanges) return

  // non-text anchors only happen at line breaks
  if (isNewLineAnchor) {
    anchor.getNode().select(anchorOffset, anchorOffset)
    return
  }

  // walk children, peel off each text/linebreak length until we land on the
  // text node that contains the original caret position
  node.getChildren().some(child => {
    const isText = $isTextNode(child)
    if (isText || $isLineBreakNode(child)) {
      const textContentSize = child.getTextContentSize()
      if (isText && textContentSize >= textOffset) {
        child.select(textOffset, textOffset)
        return true
      }
      textOffset -= textContentSize
    }
    return false
  })
}

// minimal diff between old children and freshly-tokenized children. returns the
// splice range [from, to) on the old list and the replacement nodes. avoids
// recreating the entire tree on every keystroke.
function getDiffRange (prevNodes, nextNodes) {
  let leadingMatch = 0
  while (leadingMatch < prevNodes.length) {
    if (!isEqual(prevNodes[leadingMatch], nextNodes[leadingMatch])) break
    leadingMatch++
  }
  const prevLen = prevNodes.length
  const nextLen = nextNodes.length
  const maxTrailingMatch = Math.min(prevLen, nextLen) - leadingMatch
  let trailingMatch = 0
  while (trailingMatch < maxTrailingMatch) {
    trailingMatch++
    if (!isEqual(prevNodes[prevLen - trailingMatch], nextNodes[nextLen - trailingMatch])) {
      trailingMatch--
      break
    }
  }
  return {
    from: leadingMatch,
    to: prevLen - trailingMatch,
    nodesForReplacement: nextNodes.slice(leadingMatch, nextLen - trailingMatch)
  }
}

// only compares CodeHighlightNode/TabNode/LineBreakNode. Plain TextNodes hit
// the `false` branch on purpose so they get replaced with CodeHighlightNodes.
function isEqual (a, b) {
  return (
    ($isCodeHighlightNode(a) && $isCodeHighlightNode(b) &&
      a.__text === b.__text &&
      a.__highlightType === b.__highlightType &&
      a.__style === b.__style) ||
    ($isTabNode(a) && $isTabNode(b)) ||
    ($isLineBreakNode(a) && $isLineBreakNode(b))
  )
}
