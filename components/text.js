import styles from './text.module.css'
import ReactMarkdown from 'react-markdown'
import gfm from 'remark-gfm'
import { LightAsync as SyntaxHighlighter } from 'react-syntax-highlighter'
import atomDark from 'react-syntax-highlighter/dist/cjs/styles/prism/atom-dark'
import React, { useState, memo, useRef, useCallback, useMemo, useEffect, createElement } from 'react'
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
    setShow(router.asPath.includes('#') && !router.asPath.includes('#itemfn-'))
    const handleRouteChange = (url, { shallow }) => {
      setShow(url.includes('#') && !url.includes('#itemfn-'))
    }

    router.events.on('hashChangeStart', handleRouteChange)

    return () => {
      router.events.off('hashChangeStart', handleRouteChange)
    }
  }, [router.asPath, router.events])

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

  const TextMediaOrLink = useCallback(props => {
    return <MediaLink {...props} outlawed={outlawed} imgproxyUrls={imgproxyUrls} topLevel={topLevel} rel={rel} />
  },
  [outlawed, imgproxyUrls, topLevel, rel])
  const H = useCallback(props => <Heading {...props} topLevel={topLevel} noFragments={noFragments} />,
    [topLevel, noFragments])

  const components = useMemo(() => ({
    h1: H,
    h2: H,
    h3: H,
    h4: H,
    h5: H,
    h6: H,
    table: Table,
    p: P,
    code: Code,
    mention: Mention,
    sub: Sub,
    item: Item,
    footnote: Footnote,
    a: ({ node, href, children, ...props }) => {
      // if outlawed, render the link as text
      if (outlawed) {
        return href
      }

      // if the link has text, and it's not a URL, render it as an external link
      const text = children[0]
      if (!!text && !/^https?:\/\//.test(text)) {
        return (
          // eslint-disable-next-line
          <a id={props.id} target='_blank' rel={rel ?? UNKNOWN_LINK_REL} href={href}>{children}</a>
        )
      }

      // assume the link is an image which will fallback to link if it's not
      return <TextMediaOrLink src={href} {...props}>{children}</TextMediaOrLink>
    },
    img: TextMediaOrLink,
    embed: Embed
  }), [outlawed, rel, itemId, H, TextMediaOrLink])

  const carousel = useCarousel()

  const markdownContent = useMemo(() => (
    <ReactMarkdown
      components={components}
      remarkPlugins={remarkPlugins}
      rehypePlugins={rehypePlugins}
      remarkRehypeOptions={{ clobberPrefix: `itemfn-${itemId}-` }}
    >
      {children}
    </ReactMarkdown>
  ), [components, remarkPlugins, rehypePlugins, children, itemId])

  const showOverflow = useCallback(() => setShow(true), [setShow])

  return (
    <div
      className={classNames(
        styles.text,
        topLevel && styles.topLevel,
        show ? styles.textUncontained : overflowing && styles.textContained
      )}
      ref={containerRef}
    >
      {
        carousel && tab !== 'preview'
          ? markdownContent
          : <CarouselProvider>{markdownContent}</CarouselProvider>
      }
      {overflowing && !show && (
        <Button
          size='lg'
          variant='info'
          className={styles.textShowFull}
          onClick={showOverflow}
        >
          show full text
        </Button>
      )}
    </div>
  )
}, isEqual)

function Mention ({ children, href, name, id }) {
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

function Sub ({ children, href, ...props }) {
  return <Link href={href}>{children}</Link>
}

function Item ({ children, href, id }) {
  return (
    <ItemPopover id={id}>
      <Link href={href}>{children}</Link>
    </ItemPopover>
  )
}

function Footnote ({ children, ...props }) {
  return (
    <Link {...props}>{children}</Link>
  )
}

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

function Heading ({ children, node, topLevel, noFragments, ...props }) {
  const [copied, setCopied] = useState(false)
  const nodeText = toString(node)
  const id = useMemo(() => noFragments ? undefined : slug(nodeText.replace(/[^\w\-\s]+/gi, '')), [nodeText, noFragments])
  const h = useMemo(() => {
    if (topLevel) {
      return node?.tagName
    }

    const h = parseInt(node?.tagName?.replace('h', '') || 0)
    if (h < 4) return `h${h + 3}`

    return 'h6'
  }, [node?.tagName, topLevel])
  const onClick = useCallback(() => {
    const location = new URL(window.location)
    location.hash = id
    copy(location.href)
    setTimeout(() => setCopied(false), 1500)
    setCopied(true)
  }, [id])
  const Icon = copied ? Thumb : LinkIcon

  return (
    <span className={styles.heading}>
      {createElement(h, { id, ...props }, children)}
      {!noFragments && topLevel &&
        <a className={classNames(styles.headingLink, copied && styles.copied)} href={`#${id}`} onClick={onClick}>
          <Icon
            width={18}
            height={18}
            className='fill-grey'
          />
        </a>}
    </span>
  )
}

function Table ({ node, ...props }) {
  return (
    <span className='table-responsive'>
      <table className='table table-bordered table-sm' {...props} />
    </span>
  )
}

function Code ({ node, inline, className, children, style, ...props }) {
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
