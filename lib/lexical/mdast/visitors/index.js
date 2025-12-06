// root
import { MdastRootVisitor, LexicalRootVisitor } from './root.js'

// paragraph
import { MdastParagraphVisitor, LexicalParagraphVisitor } from './paragraph.js'

// text
import { MdastTextVisitor, LexicalTextVisitor } from './text.js'

// linebreak
import { MdastBreakVisitor, LexicalLinebreakVisitor } from './linebreak.js'

// formatting
import { formattingVisitors } from './formatting.js'

// heading
import { MdastHeadingVisitor, LexicalHeadingVisitor } from './heading.js'

// link, embed, media, image
import {
  MdastItemMentionFromLinkVisitor,
  MdastEmbedFromLinkVisitor,
  MdastMediaFromLinkVisitor,
  MdastLinkVisitor,
  MdastImageVisitor,
  LexicalLinkVisitor,
  LexicalEmbedVisitor,
  LexicalMediaVisitor
} from './link.js'

// quote
import { MdastQuoteVisitor, LexicalQuoteVisitor } from './quote.js'

// list
import {
  MdastListVisitor,
  MdastListItemVisitor,
  LexicalListVisitor,
  LexicalListItemVisitor
} from './list.js'

// code
import { MdastCodeBlockVisitor, LexicalCodeBlockVisitor } from './code.js'

// horizontal rule
import { MdastHorizontalRuleVisitor, LexicalHorizontalRuleVisitor } from './horizontal-rule.js'

// mentions
import {
  MdastUserMentionVisitor,
  MdastTerritoryMentionVisitor,
  LexicalUserMentionVisitor,
  LexicalTerritoryMentionVisitor,
  LexicalItemMentionVisitor
} from './mentions.js'

import {
  MdastTableVisitor,
  MdastTableRowVisitor,
  MdastTableCellVisitor,
  LexicalTableVisitor,
  LexicalTableRowVisitor,
  LexicalTableCellVisitor
} from './table.js'

// math
import {
  MdastMathVisitor,
  MdastInlineMathVisitor,
  LexicalMathVisitor
} from './math.js'

export { isMdastText } from './text.js'

// pre-assembled visitor arrays for convenience
export const importVisitors = [
  MdastRootVisitor,
  MdastParagraphVisitor,
  MdastTextVisitor,
  MdastBreakVisitor,
  MdastHeadingVisitor,
  MdastItemMentionFromLinkVisitor,
  MdastEmbedFromLinkVisitor,
  MdastMediaFromLinkVisitor,
  MdastLinkVisitor,
  MdastImageVisitor,
  MdastQuoteVisitor,
  MdastListVisitor,
  MdastListItemVisitor,
  MdastCodeBlockVisitor,
  MdastHorizontalRuleVisitor,
  MdastUserMentionVisitor,
  MdastTerritoryMentionVisitor,
  MdastTableVisitor,
  MdastTableRowVisitor,
  MdastTableCellVisitor,
  MdastMathVisitor,
  MdastInlineMathVisitor,
  ...formattingVisitors
]

export const exportVisitors = [
  LexicalRootVisitor,
  LexicalParagraphVisitor,
  LexicalTextVisitor,
  LexicalLinebreakVisitor,
  LexicalHeadingVisitor,
  LexicalLinkVisitor,
  LexicalEmbedVisitor,
  LexicalMediaVisitor,
  LexicalQuoteVisitor,
  LexicalListVisitor,
  LexicalListItemVisitor,
  LexicalCodeBlockVisitor,
  LexicalHorizontalRuleVisitor,
  LexicalUserMentionVisitor,
  LexicalTerritoryMentionVisitor,
  LexicalItemMentionVisitor,
  LexicalTableVisitor,
  LexicalTableRowVisitor,
  LexicalTableCellVisitor,
  LexicalMathVisitor
]
