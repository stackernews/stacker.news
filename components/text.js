import styles from './text.module.css'
import React, { useState, useRef, useCallback, useMemo, useEffect } from 'react'
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

export function useOverflow ({ containerRef, truncated = false }) {
  const router = useRouter()
  // would the text overflow on the current screen size?
  const [overflowing, setOverflowing] = useState(false)
  // should we show the full text?
  const [show, setShow] = useState(false)
  const showOverflow = useCallback(() => setShow(true), [setShow])

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
  }, [router.asPath, router.events])

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

    window.addEventListener('resize', checkOverflow)
    checkOverflow()
    return () => {
      window.removeEventListener('resize', checkOverflow)
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
  }, [showOverflow, overflowing, show, setShow])

  return { overflowing, show, setShow, Overflow }
}

export default function Text ({ topLevel, children, className, state, html, outlawed, imgproxyUrls, rel, readerRef }) {
  const containerRef = useRef(null)
  const { overflowing, show, Overflow } = useOverflow({ containerRef, truncated: !!children })
  const carousel = useCarousel()

  const textClassNames = useMemo(() => {
    return classNames(
      'sn-text',
      topLevel && 'sn-text--top-level',
      show ? 'sn-text--uncontained' : overflowing && 'sn-text--contained',
      className
    )
  }, [topLevel, show, overflowing, className])

  const lexicalContent = useMemo(() => {
    return (
      <SNReader
        topLevel={topLevel}
        state={state}
        text={children} // if children is provided, it will be used as the markdown text content
        html={html}
        outlawed={outlawed}
        imgproxyUrls={imgproxyUrls}
        rel={rel}
        readerRef={readerRef}
      />
    )
  }, [children, topLevel, state, html, outlawed, imgproxyUrls, rel, readerRef])

  return (
    <div className={textClassNames} ref={containerRef}>
      {carousel
        ? lexicalContent
        : <CarouselProvider>{lexicalContent}</CarouselProvider>}
      {Overflow}
    </div>
  )
}
