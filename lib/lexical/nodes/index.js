import { HeadingNode, QuoteNode } from '@lexical/rich-text'
import { TableCellNode, TableNode, TableRowNode } from '@lexical/table'
import { ListItemNode, ListNode } from '@lexical/list'
import { CodeHighlightNode, CodeNode } from '@lexical/code'
import { AutoLinkNode, LinkNode } from '@lexical/link'
import { HorizontalRuleNode } from '@lexical/react/LexicalHorizontalRuleNode'
import { MediaNode } from './content/media/media'
import { MediaOrLinkNode } from './content/mediaorlink'
import { MentionNode } from './decorative/mentions/user-mention'
import { TerritoryNode } from './decorative/mentions/territory-mention'
import { EmbedNodes } from './content/embeds'
import { MarkdownNode } from './core/markdown'
import { MathNode } from './formatting/math/mathnode'

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
