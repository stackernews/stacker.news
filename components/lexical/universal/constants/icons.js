import BoldIcon from '@/svgs/lexical/bold.svg'
import ItalicIcon from '@/svgs/lexical/italic.svg'
import UnderlineIcon from '@/svgs/lexical/underline.svg'
import StrikethroughIcon from '@/svgs/lexical/strikethrough.svg'
import LinkIcon from '@/svgs/lexical/link.svg'
import LinkUnlinkIcon from '@/svgs/lexical/link-unlink.svg'
import Heading1Icon from '@/svgs/lexical/block/h-1.svg'
import Heading2Icon from '@/svgs/lexical/block/h-2.svg'
import Heading3Icon from '@/svgs/lexical/block/h-3.svg'
import QuoteIcon from '@/svgs/lexical/quote-text.svg'
import NumberedListIcon from '@/svgs/lexical/block/number-list.svg'
import BulletListIcon from '@/svgs/lexical/block/bullet-list.svg'
import CheckListIcon from '@/svgs/lexical/block/check-list.svg'
import CodeIcon from '@/svgs/lexical/code-view.svg'
import CodeBlockIcon from '@/svgs/lexical/code-block.svg'
import LeftIcon from '@/svgs/lexical/align/align-left.svg'
import CenterIcon from '@/svgs/lexical/align/align-center.svg'
import RightIcon from '@/svgs/lexical/align/align-right.svg'
import JustifyIcon from '@/svgs/lexical/align/align-justify.svg'
import IndentDecreaseIcon from '@/svgs/lexical/align/indent-decrease.svg'
import IndentIncreaseIcon from '@/svgs/lexical/align/indent-increase.svg'
import UploadIcon from '@/svgs/lexical/inserts/paperclip.svg'
import TableIcon from '@/svgs/lexical/inserts/table-3.svg'
import MathIcon from '@/svgs/lexical/inserts/formula.svg'
import ParagraphIcon from '@/svgs/lexical/block/blocks.svg'

export const ICONS = {
  bold: { default: BoldIcon },
  italic: { default: ItalicIcon },
  underline: { default: UnderlineIcon },
  strikethrough: { default: StrikethroughIcon },
  link: { default: LinkIcon, active: LinkUnlinkIcon },
  paragraph: { default: ParagraphIcon },
  h1: { default: Heading1Icon },
  h2: { default: Heading2Icon },
  h3: { default: Heading3Icon },
  quote: { default: QuoteIcon },
  number: { default: NumberedListIcon },
  bullet: { default: BulletListIcon },
  check: { default: CheckListIcon },
  'code-block': { default: CodeBlockIcon },
  code: { default: CodeIcon },
  left: { default: LeftIcon },
  center: { default: CenterIcon },
  right: { default: RightIcon },
  justify: { default: JustifyIcon },
  'indent-decrease': { default: IndentDecreaseIcon },
  'indent-increase': { default: IndentIncreaseIcon },
  upload: { default: UploadIcon },
  table: { default: TableIcon },
  math: { default: MathIcon },
  'math-inline': { default: MathIcon }
}

export const getIcon = (id, state = 'default') => {
  const icon = ICONS[id]
  if (!icon) return null

  // fallback to default if the requested state is not defined
  return icon[state] || icon.default
}
