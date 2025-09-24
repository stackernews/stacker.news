import { HeadingNode, QuoteNode } from '@lexical/rich-text'
import { TableCellNode, TableNode, TableRowNode } from '@lexical/table'
import { ListItemNode, ListNode } from '@lexical/list'
import { CodeHighlightNode, CodeNode } from '@lexical/code'
import { AutoLinkNode, LinkNode } from '@lexical/link'
import { HorizontalRuleNode } from '@lexical/react/LexicalHorizontalRuleNode'
import { ImageNode } from '@/lib/lexical/nodes/media/imagenode'
import { MediaOrLinkNode } from '@/lib/lexical/nodes/mediaorlink'
import { MentionNode } from '@/lib/lexical/nodes/mention'
import { TweetNode } from '@/lib/lexical/nodes/embeds/tweet'
import { WavlakeNode } from '@/lib/lexical/nodes/embeds/wavlake'
import { YouTubeNode } from '@/lib/lexical/nodes/embeds/youtube'
import { RumbleNode } from '@/lib/lexical/nodes/embeds/rumble'
import { PeerTubeNode } from '@/lib/lexical/nodes/embeds/peertube'
import { SpotifyNode } from '@/lib/lexical/nodes/embeds/spotify'
import { NostrNode } from '@/lib/lexical/nodes/embeds/nostr'
import { TerritoryNode } from '@/lib/lexical/nodes/territorymention'

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
  ImageNode,
  MediaOrLinkNode,
  MentionNode,
  TerritoryNode,
  // embeds, maybe we should separate
  TweetNode,
  WavlakeNode,
  YouTubeNode,
  RumbleNode,
  PeerTubeNode,
  SpotifyNode,
  NostrNode
]

export default DefaultNodes
