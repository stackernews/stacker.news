import styles from './text.module.css'
import ReactMarkdown from 'react-markdown'
import YouTube from 'react-youtube'
import gfm from 'remark-gfm'
import { LightAsync as SyntaxHighlighter } from 'react-syntax-highlighter'
import atomDark from 'react-syntax-highlighter/dist/cjs/styles/prism/atom-dark'
import mention from '../lib/remark-mention'
import sub from '../lib/remark-sub'
import React, { useState, memo, useRef, useCallback, useMemo, useEffect } from 'react'
import GithubSlugger from 'github-slugger'
import LinkIcon from '../svgs/link.svg'
import Thumb from '../svgs/thumb-up-fill.svg'
import { toString } from 'mdast-util-to-string'
import copy from 'clipboard-copy'
import ZoomableImage, { decodeOriginalUrl } from './image'
import { IMGPROXY_URL_REGEXP, parseInternalLinks } from '../lib/url'
import reactStringReplace from 'react-string-replace'
import { rehypeInlineCodeProperty } from '../lib/md'
import { Button } from 'react-bootstrap'
import { useRouter } from 'next/router'
import Link from 'next/link'

export function SearchText ({ text }) {
  return (
    <div className={styles.text}>
      <p className={styles.p}>
        {reactStringReplace(text, /\*\*\*([^*]+)\*\*\*/g, (match, i) => {
          return <mark key={`strong-${match}-${i}`}>{match}</mark>
        })}
      </p>
    </div>
  )
}

// this is one of the slowest components to render
export default memo(function Text ({ nofollow, imgproxyUrls, children, tab, itemId, ...outerProps }) {
  const [overflowing, setOverflowing] = useState(false)
  const router = useRouter()
  const [show, setShow] = useState(false)
  const containerRef = useRef(null)

  useEffect(() => {
    setShow(router.asPath.includes('#'))
    const handleRouteChange = (url, { shallow }) => {
      setShow(url.includes('#'))
    }

    router.events.on('hashChangeStart', handleRouteChange)

    return () => {
      router.events.off('hashChangeStart', handleRouteChange)
    }
  }, [router])

  useEffect(() => {
    const container = containerRef.current
    if (!container || overflowing) return

    function checkOverflow () {
      setOverflowing(container.scrollHeight > window.innerHeight * 2)
    }

    let resizeObserver
    if (!overflowing && 'ResizeObserver' in window) {
      resizeObserver = new window.ResizeObserver(checkOverflow).observe(container)
    }

    window.addEventListener('resize', checkOverflow)
    checkOverflow()

    return () => {
      window.removeEventListener('resize', checkOverflow)
      resizeObserver?.disconnect()
    }
  }, [containerRef.current, setOverflowing])

  const slugger = new GithubSlugger()

  const Heading = useCallback(({ children, node, ...props }) => {
    const [copied, setCopied] = useState(false)
    const { noFragments, topLevel } = outerProps
    const id = useMemo(() =>
      noFragments ? undefined : slugger?.slug(toString(node).replace(/[^\w\-\s]+/gi, '')), [node, noFragments, slugger])
    const h = useMemo(() => {
      if (topLevel) {
        return node?.TagName
      }

      const h = parseInt(node?.tagName?.replace('h', '') || 0)
      if (h < 4) return `h${h + 3}`

      return 'h6'
    }, [node, topLevel])
    const Icon = copied ? Thumb : LinkIcon

    return (
      <span className={styles.heading}>
        {React.createElement(h || node?.tagName, { id, ...props }, children)}
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
  }, [outerProps, slugger.current])

  const Table = useCallback(({ node, ...props }) =>
    <span className='table-responsive'>
      <table className='table table-bordered table-sm' {...props} />
    </span>, [])

  const Code = useCallback(({ node, inline, className, children, style, ...props }) => {
    return inline
      ? (
        <code className={className} {...props}>
          {children}
        </code>
        )
      : (
        <SyntaxHighlighter style={atomDark} language='text' PreTag='div' {...props}>
          {children}
        </SyntaxHighlighter>
        )
  }, [])

  const P = useCallback(({ children, node, ...props }) => <div className={styles.p} {...props}>{children}</div>, [])

  const Img = useCallback(({ node, src, ...props }) => {
    const url = IMGPROXY_URL_REGEXP.test(src) ? decodeOriginalUrl(src) : src
    const srcSet = imgproxyUrls?.[url]
    return <ZoomableImage srcSet={srcSet} tab={tab} src={src} {...props} {...outerProps} />
  }, [imgproxyUrls, outerProps, tab])

  return (
    <div className={`${styles.text} ${show ? styles.textUncontained : overflowing ? styles.textContained : ''}`} ref={containerRef}>
      <ReactMarkdown
        components={{
          h1: Heading,
          h2: Heading,
          h3: Heading,
          h4: Heading,
          h5: Heading,
          h6: Heading,
          table: Table,
          p: P,
          li: props => {
            return <li {...props} id={props.id && itemId ? `${props.id}-${itemId}` : props.id} />
          },
          code: Code,
          a: ({ node, href, children, ...props }) => {
            children = children ? Array.isArray(children) ? children : [children] : []
            // don't allow zoomable images to be wrapped in links
            if (children.some(e => e?.props?.node?.tagName === 'img')) {
              return <>{children}</>
            }

            // If [text](url) was parsed as <a> and text is not empty and not a link itself,
            // we don't render it as an image since it was probably a conscious choice to include text.
            const text = children[0]
            if (!!text && !/^https?:\/\//.test(text)) {
              if (props['data-footnote-ref'] || typeof props['data-footnote-backref'] !== 'undefined') {
                return (
                  <Link
                    {...props}
                    id={props.id && itemId ? `${props.id}-${itemId}` : props.id}
                    rel={`noreferrer ${nofollow ? 'nofollow' : ''} noopener`}
                    href={itemId ? `${href}-${itemId}` : href}
                  >{text}
                  </Link>
                )
              }
              return (
                <a id={props.id} target='_blank' rel={`noreferrer ${nofollow ? 'nofollow' : ''} noopener`} href={href}>{text}</a>
              )
            }

            try {
              const linkText = parseInternalLinks(href)
              if (linkText) {
                return <a target='_blank' href={href} rel='noreferrer'>{linkText}</a>
              }
            } catch {
              // ignore errors like invalid URLs
            }

            // if the link is to a youtube video, render the video
            const youtube = href.match(/(https?:\/\/)?((www\.)?(youtube(-nocookie)?|youtube.googleapis)\.com.*(v\/|v=|vi=|vi\/|e\/|embed\/|user\/.*\/u\/\d+\/)|youtu\.be\/)(?<id>[_0-9a-z-]+)((?:\?|&)(?:t|start)=(?<start>\d+))?/i)
            if (youtube?.groups?.id) {
              return (
                <div style={{ maxWidth: outerProps.topLevel ? '640px' : '320px', paddingRight: '15px', margin: '0.5rem 0' }}>
                  <YouTube
                    videoId={youtube.groups.id} className={styles.youtubeContainer} opts={{
                      playerVars: {
                        start: youtube?.groups?.start
                      }
                    }}
                  />
                </div>
              )
            }

            // assume the link is an image which will fallback to link if it's not
            return <Img src={href} nofollow={nofollow} {...props}>{children}</Img>
          },
          img: Img
        }}
        remarkPlugins={[gfm, mention, sub]}
        rehypePlugins={[rehypeInlineCodeProperty]}
      >
        {children}
      </ReactMarkdown>
      {overflowing && !show &&
        <Button size='lg' variant='info' className={styles.textShowFull} onClick={() => setShow(true)}>
          show full text
        </Button>}
    </div>
  )
})
