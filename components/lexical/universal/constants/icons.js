import BoldIcon from '@/svgs/lexical/bold.svg'
import ItalicIcon from '@/svgs/lexical/italic.svg'
import UnderlineIcon from '@/svgs/lexical/underline.svg'
import StrikethroughIcon from '@/svgs/lexical/strikethrough.svg'
import LinkIcon from '@/svgs/lexical/link.svg'
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

export const ICON_REGISTRY = {
  bold: <BoldIcon />,
  italic: <ItalicIcon />,
  underline: <UnderlineIcon />,
  strikethrough: <StrikethroughIcon />,
  link: <LinkIcon />,
  paragraph: null,
  h1: <Heading1Icon />,
  h2: <Heading2Icon />,
  h3: <Heading3Icon />,
  quote: <QuoteIcon />,
  number: <NumberedListIcon />,
  bullet: <BulletListIcon />,
  check: <CheckListIcon />,
  'code-block': <CodeBlockIcon />,
  code: <CodeIcon />,
  left: <LeftIcon />,
  center: <CenterIcon />,
  right: <RightIcon />,
  justify: <JustifyIcon />,
  'indent-decrease': <IndentDecreaseIcon />,
  'indent-increase': <IndentIncreaseIcon />,
  upload: <UploadIcon />,
  table: <TableIcon />,
  math: <MathIcon />,
  'math-inline': <MathIcon />
}

export const getIcon = (id) => ICON_REGISTRY[id] || null
