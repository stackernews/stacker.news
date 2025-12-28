import {
  $createFootnoteReferenceNode, $isFootnoteReferenceNode,
  $createFootnoteDefinitionNode, $isFootnoteDefinitionNode,
  $createFootnotesSectionNode, $isFootnotesSectionNode,
  $createFootnoteBackrefNode, $isFootnoteBackrefNode
} from '@/lib/lexical/nodes/decorative/footnote'

/**
 * mdast footnoteReference -> lexical FootnoteReferenceNode
 * inline [^1] references
 */
export const MdastFootnoteReferenceVisitor = {
  testNode: 'footnoteReference',
  visitNode ({ mdastNode, actions }) {
    const node = $createFootnoteReferenceNode({
      identifier: mdastNode.identifier,
      label: mdastNode.label || mdastNode.identifier
    })
    actions.addAndStepInto(node)
  }
}

/** lexical FootnoteReferenceNode -> mdast footnoteReference */
export const LexicalFootnoteReferenceVisitor = {
  testLexicalNode: $isFootnoteReferenceNode,
  visitLexicalNode ({ lexicalNode, mdastParent, actions }) {
    actions.appendToParent(mdastParent, {
      type: 'footnoteReference',
      identifier: lexicalNode.getIdentifier(),
      label: lexicalNode.getLabel()
    })
  }
}

/**
 * mdast footnoteDefinition -> lexical FootnoteDefinitionNode
 * [^1]: definition blocks
 */
export const MdastFootnoteDefinitionVisitor = {
  testNode: 'footnoteDefinition',
  visitNode ({ mdastNode, actions }) {
    const node = $createFootnoteDefinitionNode({
      identifier: mdastNode.identifier,
      label: mdastNode.label || mdastNode.identifier
    })
    actions.addAndStepInto(node)
  }
}

/** lexical FootnoteDefinitionNode -> mdast footnoteDefinition */
export const LexicalFootnoteDefinitionVisitor = {
  testLexicalNode: $isFootnoteDefinitionNode,
  visitLexicalNode ({ lexicalNode, actions }) {
    actions.addAndStepInto('footnoteDefinition', {
      identifier: lexicalNode.getIdentifier(),
      label: lexicalNode.getLabel()
    })
  }
}

/**
 * mdast footnotesSection -> lexical FootnotesSectionNode
 * list of footnote definitions in a section at the bottom of the document
 */
export const MdastFootnotesSectionVisitor = {
  testNode: 'footnotesSection',
  visitNode ({ actions }) {
    const node = $createFootnotesSectionNode()
    actions.addAndStepInto(node)
  }
}

/**
 * lexical FootnotesSectionNode -> mdast footnotesSection
 * unwraps the footnote definitions from the section and adds them back to the root
 */
export const LexicalFootnotesSectionVisitor = {
  testLexicalNode: $isFootnotesSectionNode,
  visitLexicalNode ({ lexicalNode, mdastParent, actions }) {
    // we'll just visit the children and add them as footnoteDefinitions at root level
    actions.visitChildren(lexicalNode, mdastParent)
  }
}

/**
 * mdast footnoteBackref -> lexical FootnoteBackrefNode
 * display-only backref link (↩) added via transform
 */
export const MdastFootnoteBackrefVisitor = {
  testNode: 'footnoteBackref',
  visitNode ({ mdastNode, actions }) {
    const node = $createFootnoteBackrefNode({
      identifier: mdastNode.identifier
    })
    actions.addAndStepInto(node)
  }
}

/**
 * lexical FootnoteBackrefNode -> nothing because it's display-only
 */
export const LexicalFootnoteBackrefVisitor = {
  testLexicalNode: $isFootnoteBackrefNode,
  visitLexicalNode () {
    // no-op - backrefs are display-only and should not be exported to markdown
  }
}
