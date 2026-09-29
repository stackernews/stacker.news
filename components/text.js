import styles from './text.module.css'
import React, { useState, useRef, useCallback, useMemo, useEffect, useSyncExternalStore } from 'react'
import reactStringReplace from 'react-string-replace'
import { Button } from 'react-bootstrap'
import { useRouter } from 'next/router'
import classNames from 'classnames'
import { CarouselProvider, useCarousel } from './carousel'
import { SNReader } from './editor'

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

export function useOverflow ({ containerRef, itemId, truncated = false }) {
  const router = useRouter()
  // would the text overflow on the current screen size?
  const [overflowing, setOverflowing] = useState(false)

  // did the user expand the text (show full text button, hash navigation)?
  const [expanded, setExpanded] = useState(false)

  const storageKey = itemId && `showFullText:${itemId}`

  // read-on-mount, not reactive: no same-tab storage event, so subscribe never fires.
  // getSnapshot runs during render so scroll restoration sees the right height.
  const subscribeNever = useCallback(() => () => {}, [])
  const storedShow = useSyncExternalStore(
    subscribeNever,
    () => (!!storageKey && window.sessionStorage.getItem(storageKey) === 'true') || window.location.hash !== '',
    () => false
  )

  const show = expanded || storedShow

  const showOverflow = useCallback(() => {
    // remember the expanded state for the rest of the tab session
    if (storageKey) window.sessionStorage.setItem(storageKey, 'true')
    setExpanded(true)
  }, [storageKey])

  // once we navigate to a hash, keep the full text shown for the rest of this mount,
  // even if the hash is later removed from the URL
  useEffect(() => {
    const handleRouteChange = (url) => {
      if (url.includes('#')) setExpanded(true)
    }

    router.events.on('hashChangeStart', handleRouteChange)

    return () => {
      router.events.off('hashChangeStart', handleRouteChange)
    }
  }, [router.events])

  // clip item and give it a`show full text` button if we are overflowing
  useEffect(() => {
    if (!containerRef.current) return

    const node = containerRef.current
    if (!node) return

    function checkOverflow () {
      setOverflowing(
        truncated
          ? node.scrollHeight > window.innerHeight * 0.5
          : node.scrollHeight > window.innerHeight * 2
      )
    }

    let resizeObserver
    if ('ResizeObserver' in window) {
      resizeObserver = new window.ResizeObserver(checkOverflow)
      resizeObserver.observe(node)
    }

    // when media is loaded from autolinks, scrollHeight changes but box size may not
    // which ResizeObserver doesn't detect, so we need to capture load events from media
    // and recheck overflow when media loads.
    function handleMediaLoad (e) {
      if (e.target.tagName === 'IMG' || e.target.tagName === 'VIDEO') {
        checkOverflow()
      }
    }
    node.addEventListener('load', handleMediaLoad, true)

    window.addEventListener('resize', checkOverflow)
    checkOverflow()
    return () => {
      window.removeEventListener('resize', checkOverflow)
      node.removeEventListener('load', handleMediaLoad, true)
      resizeObserver?.disconnect()
    }
  }, [containerRef, setOverflowing, truncated])

  const Overflow = useMemo(() => {
    if (overflowing && !show) {
      return (
        <Button
          size='lg'
          variant='info'
          className='sn-text__show-full'
          onClick={showOverflow}
        >
          show full text
        </Button>
      )
    }
    return null
  }, [showOverflow, overflowing, show])

  return { overflowing, show, setShow: setExpanded, Overflow }
}

/**
 * Renders rich content from Markdown or Lexical state
 *
 * @param {object} props - props object
 * @param {boolean} props.topLevel - whether to render as top-level content
 * @param {string} props.children - Markdown text
 * @param {string} props.className - container class name
 * @param {string} props.innerClassName - Lexical contenteditable className
 * @param {string} props.state - serialized Lexical state
 * @param {string} props.html - pre-Lexical SSR HTML content
 * @param {object} props.imgproxyUrls - imgproxy data object
 * @param {string} props.rel - link rel attribute
 * @param {string} props.name - link name attribute
 * @param {object} props.readerRef - reader ref
 */
export default function Text (props) {
  // if we don't have anything to render, bail
  if (!props.state && !props.children?.trim()) return null
  return <TextBody {...props} />
}

export function TextBody ({ topLevel, itemId, children, className, innerClassName, state, html, imgproxyUrls, rel, name, readerRef }) {
  const containerRef = useRef(null)
  const { overflowing, show, Overflow } = useOverflow({ containerRef, itemId, truncated: !!children })
  const carousel = useCarousel()

  const textClassNames = useMemo(() => {
    return classNames(
      'sn-text',
      topLevel && 'topLevel',
      show ? 'sn-text--uncontained' : overflowing && 'sn-text--contained',
      className
    )
  }, [topLevel, show, overflowing, className])

  const lexicalContent = useMemo(() => {
    return (
      <SNReader
        topLevel={topLevel}
        state={state}
        text={children} // if children is provided, markdown will be parsed and rendered
        html={html}
        imgproxyUrls={imgproxyUrls}
        rel={rel}
        readerRef={readerRef}
        name={name}
        innerClassName={innerClassName}
      />
    )
  }, [children, topLevel, state, html, imgproxyUrls, rel, readerRef, name, innerClassName])

  return (
    <div className={textClassNames} ref={containerRef}>
      {carousel
        ? lexicalContent
        : <CarouselProvider>{lexicalContent}</CarouselProvider>}
      {Overflow}
    </div>
  )
}
