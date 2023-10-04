import styles from './text.module.css'
import ReactMarkdown from 'react-markdown'
import gfm from 'remark-gfm'
import { LightAsync as SyntaxHighlighter } from 'react-syntax-highlighter'
import atomDark from 'react-syntax-highlighter/dist/cjs/styles/prism/atom-dark'
import mention from '../lib/remark-mention'
import sub from '../lib/remark-sub'
import React, { useState, memo, useRef, useCallback, useMemo } from 'react'
import GithubSlugger from 'github-slugger'
import LinkIcon from '../svgs/link.svg'
import Thumb from '../svgs/thumb-up-fill.svg'
import { toString } from 'mdast-util-to-string'
import copy from 'clipboard-copy'
import ZoomableImage, { decodeOriginalUrl } from './image'
import { IMGPROXY_URL_REGEXP } from '../lib/url'
import reactStringReplace from 'react-string-replace'

export function SearchText ({ text }) {
  return (
    <div className={styles.text}>
      <p className={styles.p}>
        {reactStringReplace(text, /\*\*\*([^*]+)\*\*\*/g, (match, i) => {
          return <mark key={`strong-${match}`}>{match}</mark>
        })}
      </p>
    </div>
  )
}

function Heading ({ level, slugger, noFragments, topLevel, children, node, ...props }) {
  const [copied, setCopied] = useState(false)
  const id = useMemo(() =>
    noFragments ? undefined : slugger.slug(toString(node).replace(/[^\w\-\s]+/gi, '')), [node, noFragments, slugger])
  const h = useMemo(() => {
    switch (level) {
      case 1:
        return topLevel ? 'h1' : 'h4'
      case 2:
        return topLevel ? 'h2' : 'h5'
      case 3:
        return topLevel ? 'h3' : 'h6'
      case 4:
        return topLevel ? 'h4' : 'h6'
      case 5:
        return topLevel ? 'h5' : 'h6'
      case 6:
        return 'h6'
      default:
        return 'h6'
    }
  }, [level, topLevel])
  const Icon = copied ? Thumb : LinkIcon

  return (
    <span className={styles.heading}>
      {React.createElement(h, { id, ...props }, children)}
      {!noFragments && topLevel &&
        <a className={`${styles.headingLink} ${copied ? styles.copied : ''}`} href={`#${id}`}>
          <Icon
            onClick={() => {
              const location = new URL(window.location)
              location.hash = `${id}`
              copy(location.href)
              setTimeout(() => setCopied(false), 1500)
              setCopied(true)
            }}
            width={18}
            height={18}
            className='fill-grey'
          />
        </a>}
    </span>
  )
}

// this is one of the slowest components to render
export default memo(function Text ({ nofollow, imgproxyUrls, children, tab, ...outerProps }) {
  // all the reactStringReplace calls are to facilitate search highlighting
  const slugger = useRef(new GithubSlugger())

  const Table = useCallback(({ node, ...props }) =>
    <span className='table-responsive'>
      <table className='table table-bordered table-sm' {...props} />
    </span>, [])

  const Code = useCallback(({ node, inline, className, children, style, ...props }) => {
    return inline
      ? (
        <code className={className} style={atomDark} {...props}>
          {children}
        </code>
        )
      : (
        <SyntaxHighlighter showLineNumbers style={atomDark} PreTag='div' {...props}>
          {children}
        </SyntaxHighlighter>
        )
  }, [])

  const P = useCallback(({ children, ...props }) => <div className={styles.p} {...props}>{children}</div>, [])

  const Img = useCallback(({ node, src, ...props }) => {
    const url = IMGPROXY_URL_REGEXP.test(src) ? decodeOriginalUrl(src) : src
    const srcSet = imgproxyUrls?.[url]
    return <ZoomableImage srcSet={srcSet} tab={tab} src={src} {...props} {...outerProps} />
  }, [imgproxyUrls, outerProps, tab])

  return (
    <div className={styles.text}>
      <ReactMarkdown
        components={{
          h1: (props) => <Heading {...props} {...outerProps} slugger={slugger.current} />,
          h2: (props) => <Heading {...props} {...outerProps} slugger={slugger.current} />,
          h3: (props) => <Heading {...props} {...outerProps} slugger={slugger.current} />,
          h4: (props) => <Heading {...props} {...outerProps} slugger={slugger.current} />,
          h5: (props) => <Heading {...props} {...outerProps} slugger={slugger.current} />,
          h6: (props) => <Heading {...props} {...outerProps} slugger={slugger.current} />,
          table: Table,
          p: P,
          code: Code,
          a: ({ node, href, children, ...props }) => {
            // don't allow zoomable images to be wrapped in links
            if (children?.some(e => e?.props?.node?.tagName === 'img')) {
              return <>{children}</>
            }

            // If [text](url) was parsed as <a> and text is not empty and not a link itself,
            // we don't render it as an image since it was probably a concious choice to include text.
            const text = children?.[0]
            if (!!text && !/^https?:\/\//.test(text)) {
              return <a target='_blank' rel={`noreferrer ${nofollow ? 'nofollow' : ''} noopener`} href={href}>{text}</a>
            }

            // assume the link is an image which will fallback to link if it's not
            return <Img src={href} nofollow={nofollow} {...props}>{children}</Img>
          },
          img: Img
        }}
        remarkPlugins={[gfm, mention, sub]}
      >
        {children}
      </ReactMarkdown>
    </div>
  )
})
