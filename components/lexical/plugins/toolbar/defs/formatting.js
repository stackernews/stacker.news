import { Actions } from '@/components/lexical/universal/constants/actions'
import AlignCenterIcon from '@/svgs/lexical/align/align-center.svg'
import AlignJustifyIcon from '@/svgs/lexical/align/align-justify.svg'
import AlignLeftIcon from '@/svgs/lexical/align/align-left.svg'
import AlignRightIcon from '@/svgs/lexical/align/align-right.svg'
import BulletList from '@/svgs/lexical/block/bullet-list.svg'
import CheckList from '@/svgs/lexical/block/check-list.svg'
import Heading1 from '@/svgs/lexical/block/h-1.svg'
import Heading2 from '@/svgs/lexical/block/h-2.svg'
import Heading3 from '@/svgs/lexical/block/h-3.svg'
import NumberList from '@/svgs/lexical/block/number-list.svg'
import Bold from '@/svgs/lexical/bold.svg'
import CodeBlock from '@/svgs/lexical/code-view.svg'
import Italic from '@/svgs/lexical/italic.svg'
import Strikethrough from '@/svgs/lexical/strikethrough.svg'
import Underline from '@/svgs/lexical/underline.svg'
import IndentDecreaseIcon from '@/svgs/lexical/align/indent-decrease.svg'
import IndentIncreaseIcon from '@/svgs/lexical/align/indent-increase.svg'
import MathIcon from '@/svgs/lexical/inserts/formula.svg'
import Quote from '@/svgs/lexical/quote-text.svg'
import TableIcon from '@/svgs/lexical/inserts/table-3.svg'

export const BLOCK_OPTIONS = [
  {
    action: Actions.paragraph,
    name: 'paragraph',
    icon: null
  },
  {
    action: Actions['heading-1'],
    name: 'heading 1',
    icon: <Heading1 />
  },
  {
    action: Actions['heading-2'],
    name: 'heading 2',
    icon: <Heading2 />
  },
  {
    action: Actions['heading-3'],
    name: 'heading 3',
    icon: <Heading3 />
  },
  {
    action: Actions['numbered-list'],
    name: 'number list',
    icon: <NumberList />
  },
  {
    action: Actions['bullet-list'],
    name: 'bullet list',
    icon: <BulletList />
  },
  {
    action: Actions['check-list'],
    name: 'check list',
    icon: <CheckList />
  },
  {
    action: Actions.quote,
    name: 'quote',
    icon: <Quote />
  },
  {
    action: Actions.code,
    name: 'code block',
    icon: <CodeBlock />
  }
]

export const FORMAT_OPTIONS = [
  {
    action: Actions.bold,
    name: 'bold',
    icon: <Bold />
  },
  {
    action: Actions.italic,
    name: 'italic',
    icon: <Italic />
  },
  {
    action: Actions.underline,
    name: 'underline',
    icon: <Underline />,
    style: { marginTop: '2px' }
  }
]

export const ADDITIONAL_FORMAT_OPTIONS = [
  {
    action: Actions.strikethrough,
    name: 'strikethrough',
    icon: <Strikethrough />
  }
]

export const ALIGN_OPTIONS = [
  {
    action: Actions.left,
    name: 'left',
    icon: <AlignLeftIcon />
  },
  {
    action: Actions.center,
    name: 'center',
    icon: <AlignCenterIcon />
  },
  {
    action: Actions.right,
    name: 'right',
    icon: <AlignRightIcon />
  },
  {
    action: Actions.justify,
    name: 'justify',
    icon: <AlignJustifyIcon />
  }
]

export const INDENT_OPTIONS = [
  {
    action: Actions['indent-decrease'],
    name: 'indent decrease',
    icon: <IndentDecreaseIcon />
  },
  {
    action: Actions['indent-increase'],
    name: 'indent increase',
    icon: <IndentIncreaseIcon />
  }
]

export const INSERT_OPTIONS = [
  {
    action: Actions.table,
    name: 'table',
    icon: <TableIcon />
  },
  {
    action: Actions.math,
    name: 'math',
    icon: <MathIcon />
  },
  {
    action: Actions['math-inline'],
    name: 'math inline',
    icon: <MathIcon />
  }
]
