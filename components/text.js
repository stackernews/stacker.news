import styles from './text.module.css'
import ReactMarkdown from 'react-markdown'
import gfm from 'remark-gfm'
import { LightAsync as SyntaxHighlighter } from 'react-syntax-highlighter'
import atomDark from 'react-syntax-highlighter/dist/cjs/styles/prism/atom-dark'
import React, { useState, memo, useRef, useCallback, useMemo, useEffect } from 'react'
import { slug } from 'github-slugger'
import LinkIcon from '@/svgs/link.svg'
import Thumb from '@/svgs/thumb-up-fill.svg'
import { toString } from 'mdast-util-to-string'
import copy from 'clipboard-copy'
import MediaOrLink, { Embed } from './media-or-link'
import { IMGPROXY_URL_REGEXP, decodeProxyUrl } from '@/lib/url'
import reactStringReplace from 'react-string-replace'
import { Button } from 'react-bootstrap'
import { useRouter } from 'next/router'
import Link from 'next/link'
import { UNKNOWN_LINK_REL } from '@/lib/constants'
import isEqual from 'lodash/isEqual'
import UserPopover from './user-popover'
import ItemPopover from './item-popover'
import classNames from 'classnames'
import { CarouselProvider, useCarousel } from './carousel'
import rehypeSN from '@/lib/rehype-sn'

const rehypeSNStyled = () => rehypeSN({
  stylers: [{
    startTag: '<sup>',
    endTag: '</sup>',
    className: styles.superscript
  }, {
    startTag: '<sub>',
    endTag: '</sub>',
    className: styles.subscript
  }]
})

const remarkPlugins = [gfm]
const rehypePlugins = [rehypeSNStyled]

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

  // if we are navigating to a hash, show the full text
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

  // clip item and give it a`show full text` button if we are overflowing
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

  const Heading = useCallback(({ children, node, ...props }) => {
    const [copied, setCopied] = useState(false)
    const nodeText = toString(node)
    const id = useMemo(() => noFragments ? undefined : slug(nodeText.replace(/[^\w\-\s]+/gi, '')), [nodeText, noFragments])
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
  }, [topLevel, noFragments])

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

  const P = useCallback(({ children, node, onlyImages, somethingBefore, somethingAfter, ...props }) =>
    <div
      className={classNames(styles.p, onlyImages && styles.onlyImages,
        somethingBefore && styles.somethingBefore, somethingAfter && styles.somethingAfter)} {...props}
    >{children}
    </div>, [])

  const TextMediaOrLink = useCallback(({ node, src, ...props }) => {
    const url = IMGPROXY_URL_REGEXP.test(src) ? decodeProxyUrl(src) : src
    // if outlawed, render the media link as text
    if (outlawed) {
      return url
    }
    const srcSet = imgproxyUrls?.[url]

    return <MediaOrLink srcSet={srcSet} tab={tab} src={src} rel={rel ?? UNKNOWN_LINK_REL} {...props} topLevel={topLevel} />
  }, [imgproxyUrls, topLevel, tab, outlawed, rel])

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
    span: ({ children, className, ...props }) => <span className={className}>{children}</span>,
    mention: ({ children, href, name, id }) => {
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
    },
    sub: ({ children, href, ...props }) => {
      return <Link href={href}>{children}</Link>
    },
    item: ({ children, href, id }) => {
      return (
        <ItemPopover id={id}>
          <Link href={href}>{children}</Link>
        </ItemPopover>
      )
    },
    a: ({ node, href, children, ...props }) => {
      // if outlawed, render the link as text
      if (outlawed) {
        return href
      }

      // if the link has text, and it's not a URL, render it as an external link
      const text = children[0]
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
        return (
          // eslint-disable-next-line
          <a id={props.id} target='_blank' rel={rel ?? UNKNOWN_LINK_REL} href={href}>{children}</a>
        )
      }

      // assume the link is an image which will fallback to link if it's not
      return <TextMediaOrLink src={href} rel={rel ?? UNKNOWN_LINK_REL} {...props}>{children}</TextMediaOrLink>
    },
    img: TextMediaOrLink,
    embed: Embed
  }), [outlawed, rel, itemId, Code, P, Heading, Table, TextMediaOrLink, Embed])

  const carousel = useCarousel()

  const markdownContent = useMemo(() => (
    <ReactMarkdown
      components={components}
      remarkPlugins={remarkPlugins}
      rehypePlugins={rehypePlugins}
    >
      {children}
    </ReactMarkdown>
  ), [components, remarkPlugins, rehypePlugins, children])

  return (
    <div
      className={classNames(
        styles.text,
        topLevel && styles.topLevel,
        show ? styles.textUncontained : overflowing && styles.textContained
      )}
      ref={containerRef}
    >
      {carousel && tab !== 'preview'
        ? markdownContent
        : <CarouselProvider>{markdownContent}</CarouselProvider>}
      {overflowing && !show && (
        <Button
          size='lg'
          variant='info'
          className={styles.textShowFull}
          onClick={() => setShow(true)}
        >
          show full text
        </Button>
      )}
    </div>
  )
}, isEqual)
