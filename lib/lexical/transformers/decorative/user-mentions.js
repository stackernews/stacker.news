import { MentionNode, $createMentionNode, $isMentionNode } from '@/lib/lexical/nodes/decorative/mentions/user-mention'

export const USER_MENTIONS = {
  dependencies: [MentionNode],
  export: (node) => {
    if (!$isMentionNode(node)) return null
    return '@' + node.getMentionName()
  },
  importRegExp: /\B@([\w_]+)/,
  regExp: /\B@([\w_]+)/,
  replace: (textNode, match) => {
    const mentionNode = $createMentionNode(null, match[1])
    textNode.replace(mentionNode)
  },
  trigger: '@',
  type: 'text-match'
}
