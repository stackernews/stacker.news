import { QuoteNode, HeadingNode } from '@lexical/rich-text'
import { TableCellNode, TableNode, TableRowNode } from '@lexical/table'
import { ListItemNode, ListNode } from '@lexical/list'
import { CodeHighlightNode, CodeNode } from '@lexical/code'
import { AutoLinkNode, LinkNode } from '@lexical/link'
import { HorizontalRuleNode } from '@lexical/extension'
import { MediaNode } from './content/media'
import { EmbedNode } from './content/embed'
import { MathNode } from './formatting/math'
import { TableOfContentsNode } from './content/toc'
import { SNHeadingNode, $createSNHeadingNode } from './misc/heading'
import {
  UserMentionNode,
  TerritoryMentionNode,
  ItemMentionNode
} from './decorative/mentions'
import {
  FootnoteReferenceNode,
  FootnoteDefinitionNode,
  FootnotesSectionNode,
  FootnoteBackrefNode
} from './decorative/footnote'

const DefaultNodes = [
  SNHeadingNode,
  {
    replace: HeadingNode,
    with: (node) => $createSNHeadingNode(node.getTag()),
    withKlass: SNHeadingNode
  },
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
  MediaNode,
  UserMentionNode,
  TerritoryMentionNode,
  ItemMentionNode,
  FootnoteReferenceNode,
  FootnoteDefinitionNode,
  FootnotesSectionNode,
  FootnoteBackrefNode,
  MathNode,
  TableOfContentsNode,
  EmbedNode
]

export default DefaultNodes
