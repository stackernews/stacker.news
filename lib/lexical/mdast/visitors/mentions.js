import { $createUserMentionNode, $isUserMentionNode } from '@/lib/lexical/nodes/decorative/mentions/user'
import { $createTerritoryMentionNode, $isTerritoryMentionNode } from '@/lib/lexical/nodes/decorative/mentions/territory'
import { $isItemMentionNode } from '@/lib/lexical/nodes/decorative/mentions/item'

// user mentions (@user, @user/path)
// uses transforms to parse mentions

// mdast -> lexical
export const MdastUserMentionVisitor = {
  testNode: 'userMention',
  visitNode ({ mdastNode, actions }) {
    const node = $createUserMentionNode({
      name: mdastNode.value.name,
      path: mdastNode.value.path || ''
    })
    actions.addAndStepInto(node)
  }
}

// lexical -> mdast
export const LexicalUserMentionVisitor = {
  testLexicalNode: $isUserMentionNode,
  visitLexicalNode ({ lexicalNode, mdastParent, actions }) {
    actions.appendToParent(mdastParent, {
      type: 'userMention',
      value: {
        name: lexicalNode.getUserMentionName(),
        path: lexicalNode.getPath() || ''
      }
    })
  }
}

// territory mentions (~territory)
// uses transforms to parse mentions

// mdast -> lexical
export const MdastTerritoryMentionVisitor = {
  testNode: 'territoryMention',
  visitNode ({ mdastNode, actions }) {
    const node = $createTerritoryMentionNode(mdastNode.value)
    actions.addAndStepInto(node)
  }
}

// lexical -> mdast
export const LexicalTerritoryMentionVisitor = {
  testLexicalNode: $isTerritoryMentionNode,
  visitLexicalNode ({ lexicalNode, mdastParent, actions }) {
    actions.appendToParent(mdastParent, {
      type: 'territoryMention',
      value: lexicalNode.getTerritoryMentionName()
    })
  }
}

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
