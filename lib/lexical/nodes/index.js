import { HeadingNode, QuoteNode } from '@lexical/rich-text'
import { TableCellNode, TableNode, TableRowNode } from '@lexical/table'
import { ListItemNode, ListNode } from '@lexical/list'
import { CodeHighlightNode, CodeNode } from '@lexical/code'
import { AutoLinkNode, LinkNode } from '@lexical/link'
import { HorizontalRuleNode } from '@lexical/react/LexicalHorizontalRuleNode'
import { MediaNode } from '@/lib/lexical/nodes/media/media-node'
import { MediaOrLinkNode } from '@/lib/lexical/nodes/mediaorlink'
import { MentionNode } from '@/lib/lexical/nodes/mention'
import { TerritoryNode } from '@/lib/lexical/nodes/territorymention'
import { EmbedNodes } from '@/lib/lexical/nodes/embeds'
import { MarkdownNode } from '@/lib/lexical/nodes/markdownnode'
import { MathNode } from '@/lib/lexical/nodes/math/mathnode'

const DefaultNodes = [
  HeadingNode,
  ListNode,
  ListItemNode,
  QuoteNode,
  CodeNode,
  CodeHighlightNode,
  TableNode,
  TableCellNode,
  TableRowNode,
  AutoLinkNode,
  LinkNode,
  HorizontalRuleNode,
  // custom SN nodes
  MarkdownNode,
  MediaNode,
  MediaOrLinkNode,
  MentionNode,
  TerritoryNode,
  MathNode,
  // embeds, maybe we should separate
  ...EmbedNodes
]

export default DefaultNodes
