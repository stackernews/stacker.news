import styles from './text.module.css'
import ReactMarkdown from 'react-markdown'
import YouTube from 'react-youtube'
import gfm from 'remark-gfm'
import { LightAsync as SyntaxHighlighter } from 'react-syntax-highlighter'
import atomDark from 'react-syntax-highlighter/dist/cjs/styles/prism/atom-dark'
import mention from '@/lib/remark-mention'
import sub from '@/lib/remark-sub'
import React, { useState, memo, useRef, useCallback, useMemo, useEffect } from 'react'
import GithubSlugger from 'github-slugger'
import LinkIcon from '@/svgs/link.svg'
import Thumb from '@/svgs/thumb-up-fill.svg'
import { toString } from 'mdast-util-to-string'
import copy from 'clipboard-copy'
import MediaOrLink from './media-or-link'
import { IMGPROXY_URL_REGEXP, parseInternalLinks, parseEmbedUrl, decodeProxyUrl } from '@/lib/url'
import reactStringReplace from 'react-string-replace'
import { rehypeInlineCodeProperty, rehypeStyler } from '@/lib/md'
import { Button } from 'react-bootstrap'
import { useRouter } from 'next/router'
import Link from 'next/link'
import { UNKNOWN_LINK_REL } from '@/lib/constants'
import isEqual from 'lodash/isEqual'
import UserPopover from './user-popover'
import ItemPopover from './item-popover'

// Explicitely defined start/end tags & which CSS class from text.module.css to apply
export const rehypeSuperscript = () => rehypeStyler('<sup>', '</sup>', styles.superscript)
export const rehypeSubscript = () => rehypeStyler('<sub>', '</sub>', styles.subscript)

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
export default memo(function Text ({ rel, imgproxyUrls, children, tab, itemId, outlawed, topLevel, noFragments }) {
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
    const nodeText = toString(node)
    const id = useMemo(() => noFragments ? undefined : slugger?.slug(nodeText.replace(/[^\w\-\s]+/gi, '')), [nodeText, noFragments, slugger])
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
  }, [topLevel, noFragments, slugger.current])

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

  const TextMediaOrLink = useCallback(({ node, src, ...props }) => {
    const url = IMGPROXY_URL_REGEXP.test(src) ? decodeProxyUrl(src) : src
    // if outlawed, render the media link as text
    if (outlawed) {
      return url
    }
    const srcSet = imgproxyUrls?.[url]
    return <MediaOrLink srcSet={srcSet} tab={tab} src={src} rel={rel ?? UNKNOWN_LINK_REL} {...props} topLevel={topLevel} />
  }, [imgproxyUrls, topLevel, tab])

  const components = useMemo(() => ({
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

      // if outlawed, render the link as text
      if (outlawed) {
        return href
      }

      // If [text](url) was parsed as <a> and text is not empty and not a link itself,
      // we don't render it as an image since it was probably a conscious choice to include text.
      const text = children[0]
      let url
      try {
        url = !href.startsWith('/') && new URL(href)
      } catch {
        // ignore invalid URLs
      }

      const internalURL = process.env.NEXT_PUBLIC_URL
      if (!!text && !/^https?:\/\//.test(text)) {
        if (props['data-footnote-ref'] || typeof props['data-footnote-backref'] !== 'undefined') {
          return (
            <Link
              {...props}
              id={props.id && itemId ? `${props.id}-${itemId}` : props.id}
              href={itemId ? `${href}-${itemId}` : href}
            >{text}
            </Link>
          )
        }
        if (text.startsWith?.('@')) {
          // user mention might be within a markdown link like this: [@user foo bar](url)
          const name = text.replace('@', '').split(' ')[0]
          return (
            <UserPopover name={name}>
              <Link
                id={props.id}
                href={href}
              >
                {text}
              </Link>
            </UserPopover>
          )
        } else if (href.startsWith('/') || url?.origin === internalURL) {
          try {
            const { linkText } = parseInternalLinks(href)
            if (linkText) {
              return (
                <ItemPopover id={linkText.replace('#', '').split('/')[0]}>
                  <Link href={href}>{text}</Link>
                </ItemPopover>
              )
            }
          } catch {
            // ignore errors like invalid URLs
          }

          return (
            <Link
              id={props.id}
              href={href}
            >
              {text}
            </Link>
          )
        }
        return (
          // eslint-disable-next-line
          <a id={props.id} target='_blank' rel={rel ?? UNKNOWN_LINK_REL} href={href}>{text}</a>
        )
      }

      try {
        const { linkText } = parseInternalLinks(href)
        if (linkText) {
          return (
            <ItemPopover id={linkText.replace('#', '').split('/')[0]}>
              <Link href={href}>{linkText}</Link>
            </ItemPopover>
          )
        }
      } catch {
        // ignore errors like invalid URLs
      }

      const videoWrapperStyles = {
        maxWidth: topLevel ? '640px' : '320px',
        margin: '0.5rem 0',
        paddingRight: '15px'
      }

      const { provider, id, meta } = parseEmbedUrl(href)
      // Youtube video embed
      if (provider === 'youtube') {
        return (
          <div style={videoWrapperStyles}>
            <YouTube
              videoId={id} className={styles.videoContainer} opts={{
                playerVars: {
                  start: meta?.start || 0
                }
              }}
            />
          </div>
        )
      }

      // Rumble video embed
      if (provider === 'rumble') {
        return (
          <div style={videoWrapperStyles}>
            <div className={styles.videoContainer}>
              <iframe
                title='Rumble Video'
                allowFullScreen
                src={meta?.href}
                sandbox='allow-scripts'
              />
            </div>
          </div>
        )
      }

      if (provider === 'peertube') {
        return (
          <div style={videoWrapperStyles}>
            <div className={styles.videoContainer}>
              <iframe
                title='PeerTube Video'
                allowFullScreen
                src={meta?.href}
                sandbox='allow-scripts'
              />
            </div>
          </div>
        )
      }

      // assume the link is an image which will fallback to link if it's not
      return <TextMediaOrLink src={href} rel={rel ?? UNKNOWN_LINK_REL} {...props}>{children}</TextMediaOrLink>
    },
    img: TextMediaOrLink
  }), [outlawed, rel, topLevel, itemId, Code, P, Heading, Table, TextMediaOrLink])

  const remarkPlugins = useMemo(() => [gfm, mention, sub], [])
  const rehypePlugins = useMemo(() => [rehypeInlineCodeProperty, rehypeSuperscript, rehypeSubscript], [])

  return (
    <div className={`${styles.text} ${show ? styles.textUncontained : overflowing ? styles.textContained : ''}`} ref={containerRef}>
      <ReactMarkdown
        components={components}
        remarkPlugins={remarkPlugins}
        rehypePlugins={rehypePlugins}
      >
        {children}
      </ReactMarkdown>
      {overflowing && !show &&
        <Button size='lg' variant='info' className={styles.textShowFull} onClick={() => setShow(true)}>
          show full text
        </Button>}
    </div>
  )
}, isEqual)
