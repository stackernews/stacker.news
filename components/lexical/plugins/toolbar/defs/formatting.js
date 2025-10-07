import Heading1 from '@/svgs/lexical/block/h-1.svg'
import Heading2 from '@/svgs/lexical/block/h-2.svg'
import Heading3 from '@/svgs/lexical/block/h-3.svg'
import NumberList from '@/svgs/lexical/block/number-list.svg'
import BulletList from '@/svgs/lexical/block/bullet-list.svg'
import CheckList from '@/svgs/lexical/block/check-list.svg'
import Quote from '@/svgs/lexical/quote-text.svg'
import CodeBlock from '@/svgs/lexical/code-view.svg'
import Bold from '@/svgs/lexical/bold.svg'
import Italic from '@/svgs/lexical/italic.svg'
import Underline from '@/svgs/lexical/underline.svg'
import Strikethrough from '@/svgs/lexical/strikethrough.svg'
import AlignLeftIcon from '@/svgs/lexical/align/align-left.svg'
import AlignCenterIcon from '@/svgs/lexical/align/align-center.svg'
import AlignRightIcon from '@/svgs/lexical/align/align-right.svg'
import AlignJustifyIcon from '@/svgs/lexical/align/align-justify.svg'
import IndentDecreaseIcon from '@/svgs/lexical/align/indent-decrease.svg'
import IndentIncreaseIcon from '@/svgs/lexical/align/indent-increase.svg'

export const BLOCK_OPTIONS = [
  {
    action: 'normal',
    name: 'normal',
    icon: null
  },
  {
    action: 'h1',
    name: 'heading 1',
    icon: <Heading1 />
  },
  {
    action: 'h2',
    name: 'heading 2',
    icon: <Heading2 />
  },
  {
    action: 'h3',
    name: 'heading 3',
    icon: <Heading3 />
  },
  {
    action: 'number',
    name: 'number list',
    icon: <NumberList />
  },
  {
    action: 'bullet',
    name: 'bullet list',
    icon: <BulletList />
  },
  {
    action: 'check',
    name: 'check list',
    icon: <CheckList />
  },
  {
    action: 'quote',
    name: 'quote',
    icon: <Quote />
  },
  {
    action: 'code',
    name: 'code block',
    icon: <CodeBlock />
  }
]

export const FORMAT_OPTIONS = [
  {
    action: 'bold',
    name: 'bold',
    icon: <Bold />
  },
  {
    action: 'italic',
    name: 'italic',
    icon: <Italic />
  },
  {
    action: 'underline',
    name: 'underline',
    icon: <Underline />,
    style: { marginTop: '2px' }
  }
]

export const ADDITIONAL_FORMAT_OPTIONS = [
  {
    action: 'strikethrough',
    name: 'strikethrough',
    icon: <Strikethrough />
  }
]

export const ALIGN_OPTIONS = [
  {
    action: 'left',
    name: 'left',
    icon: <AlignLeftIcon />
  },
  {
    action: 'center',
    name: 'center',
    icon: <AlignCenterIcon />
  },
  {
    action: 'right',
    name: 'right',
    icon: <AlignRightIcon />
  },
  {
    action: 'justify',
    name: 'justify',
    icon: <AlignJustifyIcon />
  }
]

export const INDENT_OPTIONS = [
  {
    action: 'indent-decrease',
    name: 'indent decrease',
    icon: <IndentDecreaseIcon />
  },
  {
    action: 'indent-increase',
    name: 'indent increase',
    icon: <IndentIncreaseIcon />
  }
]
