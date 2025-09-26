import UserPopover from '@/components/user-popover'
import Link from 'next/link'
import { UNKNOWN_LINK_REL } from '@/lib/constants'
import { IMGPROXY_URL_REGEXP, decodeProxyUrl } from '@/lib/url'
import MediaOrLink from '@/components/media-or-link'
import classNames from 'classnames'
import styles from '@/components/lexical/theme/theme.module.css'
import { useState, useCallback, useEffect, createElement, Fragment } from 'react'
import dynamic from 'next/dynamic'

// lexical TextNode formatting
const IS_BOLD = 1
const IS_ITALIC = 1 << 1
const IS_STRIKETHROUGH = 1 << 2
const IS_UNDERLINE = 1 << 3
const IS_CODE = 1 << 4
const IS_SUBSCRIPT = 1 << 5
const IS_SUPERSCRIPT = 1 << 6
const IS_HIGHLIGHT = 1 << 7
const IS_LOWERCASE = 1 << 8
const IS_UPPERCASE = 1 << 9
const IS_CAPITALIZE = 1 << 10

function wrapTextFormat (content, formatInt) {
  let result = content

  // bitwise AND to check each format bit
  if (formatInt & IS_BOLD) result = <b>{result}</b>
  if (formatInt & IS_ITALIC) result = <i>{result}</i>
  if (formatInt & IS_UNDERLINE) result = <u>{result}</u>
  if (formatInt & IS_STRIKETHROUGH) result = <s>{result}</s>
  if (formatInt & IS_CODE) result = <code>{result}</code>
  if (formatInt & IS_SUBSCRIPT) result = <sub>{result}</sub>
  if (formatInt & IS_SUPERSCRIPT) result = <sup>{result}</sup>
  if (formatInt & IS_HIGHLIGHT) result = <span className='highlight'>{result}</span>
  if (formatInt & IS_LOWERCASE) result = <span style={{ textTransform: 'lowercase' }}>{result}</span>
  if (formatInt & IS_UPPERCASE) result = <span style={{ textTransform: 'uppercase' }}>{result}</span>
  if (formatInt & IS_CAPITALIZE) result = <span style={{ textTransform: 'capitalize' }}>{result}</span>

  return result
}

function renderMan (nodes, keyPrefix = '') {
  return nodes.map((node, index) => {
    const key = keyPrefix + index

    switch (node.type) {
      // paragraphs <p>
      case 'paragraph': return <P key={key}>{renderMan(node.children ?? [], key + '-p-')}</P>

      // headings <h1-6>
      case 'heading': {
        const level = node.tag ?? 'h1'
        return createElement(level, { key }, renderMan(node.children ?? [], key + '-h-'))
      }

      // text
      case 'text': {
        const nodeFormat = node.format ?? {}
        return <Fragment key={key}>{wrapTextFormat(node.text, nodeFormat)}</Fragment>
      }

      // <br>
      case 'linebreak':
        return <br key={key} />

      // <Link> from next.js
      case 'link': {
        const href = node.url
        const child = renderMan(node.children ?? [], key + '-a-')
        return <Link key={key} href={href} rel={node.rel} target={node.target}>{child}</Link>
      }

      // our own mentions
      case 'mention': {
        const href = '/' + node.mentionName
        const child = renderMan(node.children ?? [], key + '-a-')
        return <Mention key={key} href={href} name={node.mentionName} id={node.id}>{child}</Mention>
      }

      case 'mediaOrLink':
      case 'image': {
        const child = renderMan(node.children ?? [], key + '-a-')
        return <MediaLink key={key} src={node.src} rel={node.rel} linkFallback={node.linkFallback} {...node.props}>{child}</MediaLink>
      }

      case 'code': {
        console.log('node', node)
        return <Code key={key} inline={node.inline} className={node.className} style={node.style} language={node.language} {...node.props}>{node.children.map(child => child.text).join('\n')}</Code>
      }

      case 'root':
        return <Fragment key={key}>{renderMan(node.children ?? [], key + '-root-')}</Fragment>

      default:
        return <Fragment key={key}>Unknown node type: {node.type}</Fragment>
    }
  })
}

export default function LexicalRenderMan ({ lexicalState }) {
  let parsedState = null

  try {
    parsedState = JSON.parse(lexicalState)
  } catch (error) {
    console.error('Error parsing lexical state', error)
  }

  if (!parsedState?.root?.children) return null

  return <div key='lexical-render-man'>{renderMan(parsedState.root.children ?? [], 'lexical-render-man-')}</div>
}

function Mention ({ children, node, href, name, id }) {
  return (
    <UserPopover name={name}>
      <Link
        id={id}
        href={href}
      >
        {children}
      </Link>
    </UserPopover>
  )
}

/* function Sub ({ children, node, href, name, ...props }) {
  return (
    <SubPopover sub={name}>
      <Link href={href}>{children}</Link>
    </SubPopover>
  )
}

function Item ({ children, node, href, id }) {
  return (
    <ItemPopover id={id}>
      <Link href={href}>{children}</Link>
    </ItemPopover>
  )
}

function Footnote ({ children, node, ...props }) {
  return (
    <Link {...props}>{children}</Link>
  )
} */

function MediaLink ({
  node, src, outlawed, imgproxyUrls, rel = UNKNOWN_LINK_REL, ...props
}) {
  const url = IMGPROXY_URL_REGEXP.test(src) ? decodeProxyUrl(src) : src
  // if outlawed, render the media link as text
  if (outlawed) {
    return url
  }

  const srcSet = imgproxyUrls?.[url]

  return <MediaOrLink srcSet={srcSet} src={src} rel={rel} {...props} />
}

/* function Table ({ node, ...props }) {
  return (
    <div className='table-responsive'>
      <table className='table table-bordered table-sm' {...props} />
    </div>
  )
} */

// prevent layout shifting when the code block is loading
function CodeSkeleton ({ className, children, ...props }) {
  return (
    <div className='rounded' style={{ padding: '0.5em' }}>
      <code className={`${className}`} {...props}>
        {children}
      </code>
    </div>
  )
}

function Code ({ node, inline, className, children, style, language, ...props }) {
  const [ReactSyntaxHighlighter, setReactSyntaxHighlighter] = useState(null)
  const [syntaxTheme, setSyntaxTheme] = useState(null)
  const lang = language || className?.match(/language-(\w+)/)?.[1] || 'text'
  console.log('lang', lang)

  const loadHighlighter = useCallback(() =>
    Promise.all([
      dynamic(() => import('react-syntax-highlighter').then(mod => mod.LightAsync), {
        ssr: false,
        loading: () => <CodeSkeleton className={className} {...props}>{children}</CodeSkeleton>
      }),
      import('react-syntax-highlighter/dist/cjs/styles/hljs/atom-one-dark').then(mod => mod.default)
    ]), []
  )

  useEffect(() => {
    if (!inline && lang !== 'math') { // MathJax should handle math
      // loading the syntax highlighter and theme only when needed
      loadHighlighter().then(([highlighter, theme]) => {
        setReactSyntaxHighlighter(() => highlighter)
        setSyntaxTheme(() => theme)
      })
    }
  }, [inline])

  if (inline || !ReactSyntaxHighlighter) { // inline code doesn't have a border radius
    return (
      <code className={className} {...props}>
        {children}
      </code>
    )
  }

  return (
    <>
      {ReactSyntaxHighlighter && syntaxTheme && (
        <ReactSyntaxHighlighter style={syntaxTheme} language={lang} PreTag='div' customStyle={{ borderRadius: '0.3rem' }} {...props}>
          {children}
        </ReactSyntaxHighlighter>
      )}
    </>
  )
}

function P ({ children, node, onlyImages, somethingBefore, somethingAfter, ...props }) {
  return (
    <div
      className={classNames(styles.p, onlyImages && styles.onlyImages,
        somethingBefore && styles.somethingBefore, somethingAfter && styles.somethingAfter)} {...props}
    >
      {children}
    </div>
  )
}
