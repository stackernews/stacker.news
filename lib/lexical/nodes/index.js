import { QuoteNode } from '@lexical/rich-text'
import { TableCellNode, TableNode, TableRowNode } from '@lexical/table'
import { ListItemNode, ListNode } from '@lexical/list'
import { CodeHighlightNode, CodeNode } from '@lexical/code'
import { AutoLinkNode, LinkNode } from '@lexical/link'
import { HorizontalRuleNode } from '@lexical/extension'
import { MediaNode } from './content/media'
import { MentionNode } from './decorative/mentions/user'
import { TerritoryNode } from './decorative/mentions/territory'
import { ItemMentionNode } from './decorative/mentions/item'
import { EmbedNodes } from './content/embeds'
import { MarkdownNode } from './core/markdown'
import { MathNode } from './formatting/math'
import { SpoilerContainerNode } from './formatting/spoiler/container'
import { SpoilerTitleNode } from './formatting/spoiler/title'
import { SpoilerContentNode } from './formatting/spoiler/content'
import { TableOfContentsNode } from './misc/toc'
import { SNHeadingNode } from './misc/heading'

const DefaultNodes = [
  SNHeadingNode,
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
  MentionNode,
  TerritoryNode,
  ItemMentionNode,
  MathNode,
  SpoilerContainerNode,
  SpoilerTitleNode,
  SpoilerContentNode,
  TableOfContentsNode,
  // embeds, maybe we should separate
  ...EmbedNodes
]

export default DefaultNodes
