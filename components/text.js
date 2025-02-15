import styles from './text.module.css'
import ReactMarkdown from 'react-markdown'
import gfm from 'remark-gfm'
import dynamic from 'next/dynamic'
import React, { useState, memo, useRef, useCallback, useMemo, useEffect } from 'react'
import MediaOrLink from './media-or-link'
import { IMGPROXY_URL_REGEXP, decodeProxyUrl } from '@/lib/url'
import reactStringReplace from 'react-string-replace'
import { Button } from 'react-bootstrap'
import { useRouter } from 'next/router'
import Link from 'next/link'
import { UNKNOWN_LINK_REL } from '@/lib/constants'
import isEqual from 'lodash/isEqual'
import SubPopover from './sub-popover'
import UserPopover from './user-popover'
import ItemPopover from './item-popover'
import classNames from 'classnames'
import { CarouselProvider, useCarousel } from './carousel'
import rehypeSN from '@/lib/rehype-sn'
import remarkUnicode from '@/lib/remark-unicode'
import Embed from './embed'
import remarkMath from 'remark-math'
import rehypeMathjax from 'rehype-mathjax'

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

const remarkPlugins = [gfm, remarkUnicode, [remarkMath, { singleDollarTextMath: false }]]
const rehypePlugins = [rehypeSNStyled, rehypeMathjax]

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
export default memo(function Text ({ rel = UNKNOWN_LINK_REL, imgproxyUrls, children, tab, itemId, outlawed, topLevel }) {
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

  const components = useMemo(() => ({
    h1: ({ node, id, ...props }) => <h1 id={topLevel ? id : undefined} {...props} />,
    h2: ({ node, id, ...props }) => <h2 id={topLevel ? id : undefined} {...props} />,
    h3: ({ node, id, ...props }) => <h3 id={topLevel ? id : undefined} {...props} />,
    h4: ({ node, id, ...props }) => <h4 id={topLevel ? id : undefined} {...props} />,
    h5: ({ node, id, ...props }) => <h5 id={topLevel ? id : undefined} {...props} />,
    h6: ({ node, id, ...props }) => <h6 id={topLevel ? id : undefined} {...props} />,
    table: Table,
    p: P,
    code: Code,
    mention: Mention,
    sub: Sub,
    item: Item,
    footnote: Footnote,
    headlink: ({ node, href, ...props }) => <Link href={href} {...props} />,
    autolink: ({ href, ...props }) => <TextMediaOrLink src={href} {...props} />,
    a: ({ node, href, children, ...props }) => {
      // if outlawed, render the link as text
      if (outlawed) {
        return href
      }

      // eslint-disable-next-line
      return <Link id={props.id} target='_blank' rel={rel} href={href}>{children}</Link>
    },
    img: TextMediaOrLink,
    embed: Embed
  }), [outlawed, rel, TextMediaOrLink, topLevel])

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

function Sub ({ children, node, href, name, ...props }) {
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

function Table ({ node, ...props }) {
  return (
    <span className='table-responsive'>
      <table className='table table-bordered table-sm' {...props} />
    </span>
  )
}

function Code ({ node, inline, className, children, style, ...props }) {
  const [ReactSyntaxHighlighter, setReactSyntaxHighlighter] = useState(null)
  const [syntaxTheme, setSyntaxTheme] = useState(null)

  const loadHighlighter = useCallback(() =>
    Promise.all([
      dynamic(() => import('react-syntax-highlighter').then(mod => mod.LightAsync), { ssr: false }),
      import('react-syntax-highlighter/dist/cjs/styles/hljs/atom-one-dark').then(mod => mod.default)
    ]), []
  )

  useEffect(() => {
    if (!inline) {
      // loading the syntax highlighter and theme only when needed
      loadHighlighter().then(([highlighter, theme]) => {
        setReactSyntaxHighlighter(() => highlighter)
        setSyntaxTheme(() => theme)
      })
    }
  }, [inline])

  if (inline || !ReactSyntaxHighlighter || !syntaxTheme) {
    return (
      <code className={className} {...props}>
        {children}
      </code>
    )
  }

  const language = className?.match(/language-(\w+)/)?.[1] || 'text'

  return (
    <ReactSyntaxHighlighter style={syntaxTheme} language={language} PreTag='div' customStyle={{ borderRadius: '0.3rem' }} {...props}>
      {children}
    </ReactSyntaxHighlighter>
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
