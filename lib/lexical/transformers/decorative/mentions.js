import { MentionNode, $createMentionNode, $isMentionNode } from '@/lib/lexical/nodes/decorative/mentions/user-mention'

export const MENTIONS = {
  dependencies: [MentionNode],
  export: (node) => {
    if (!$isMentionNode(node)) return null
    return '@' + node.getMentionName()
  },
  importRegExp: /@([^\s]+)/,
  regExp: /@([^\s]+)/,
  replace: (textNode, match) => {
    const mentionNode = $createMentionNode(match[1])
    textNode.replace(mentionNode)
  },
  trigger: '@',
  type: 'text-match'
}
