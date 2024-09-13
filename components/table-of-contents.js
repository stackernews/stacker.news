import React, { useMemo, useState } from 'react'
import Dropdown from 'react-bootstrap/Dropdown'
import FormControl from 'react-bootstrap/FormControl'
import TocIcon from '@/svgs/list-unordered.svg'
import { fromMarkdown } from 'mdast-util-from-markdown'
import { visit } from 'unist-util-visit'
import { toString } from 'mdast-util-to-string'
import { slug } from 'github-slugger'
import { useRouter } from 'next/router'

export default function Toc ({ text }) {
  const router = useRouter()
  if (!text || text.length === 0) {
    return null
  }

  const toc = useMemo(() => {
    const tree = fromMarkdown(text)
    const toc = []
    visit(tree, 'heading', (node, position, parent) => {
      const str = toString(node)
      toc.push({ heading: str, slug: slug(str.replace(/[^\w\-\s]+/gi, '')), depth: node.depth })
    })

    return toc
  }, [text])

  if (toc.length === 0) {
    return null
  }

  return (
    <Dropdown align='end' className='d-flex align-items-center'>
      <Dropdown.Toggle as={CustomToggle} id='dropdown-custom-components'>
        <TocIcon width={20} height={20} className='mx-2 fill-grey theme' />
      </Dropdown.Toggle>

      <Dropdown.Menu as={CustomMenu}>
        {toc.map(v => {
          return (
            <Dropdown.Item
              className={v.depth === 1 ? 'fw-bold' : ''}
              style={{
                marginLeft: `${(v.depth - 1) * 5}px`
              }}
              href={`#${v.slug}`} key={v.slug}
              // nextjs router doesn't emit hashChangeStart events
              onClick={() => router.events.emit('hashChangeStart', `#${v.slug}`, { shallow: true })}
            >{v.heading}
            </Dropdown.Item>
          )
        })}
      </Dropdown.Menu>
    </Dropdown>
  )
}

const CustomToggle = React.forwardRef(({ children, onClick }, ref) => (
  <a
    href=''
    ref={ref}
    onClick={(e) => {
      e.preventDefault()
      onClick(e)
    }}
  >
    {children}
  </a>
))

// forwardRef again here!
// Dropdown needs access to the DOM of the Menu to measure it
const CustomMenu = React.forwardRef(
  ({ children, style, className, 'aria-labelledby': labeledBy }, ref) => {
    const [value, setValue] = useState('')

    return (
      <div
        ref={ref}
        style={style}
        className={className}
        aria-labelledby={labeledBy}
      >
        <FormControl
          className='mx-3 my-2 w-auto'
          placeholder='filter'
          onChange={(e) => setValue(e.target.value)}
          value={value}
        />
        <ul className='list-unstyled'>
          {React.Children.toArray(children).filter(
            (child) =>
              !value || child.props.children.toLowerCase().includes(value)
          )}
        </ul>
      </div>
    )
  }
)
