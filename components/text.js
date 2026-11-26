import styles from './text.module.css'
import React, { useState, useRef, useCallback, useMemo, useEffect } from 'react'
import SearchHighlight from './search-highlight'
import Button from '@/components/ui/button'
import { useRouter } from 'next/router'
import classNames from 'classnames'
import { CarouselProvider, useCarousel } from './carousel'
import { SNReader } from './editor'
import useClipped from './use-clipped'

export function SearchText ({ text }) {
  return (
    <div className={styles.text}>
      <p className={styles.p}><SearchHighlight text={text} /></p>
    </div>
  )
}

export function useOverflow ({ containerRef }) {
  const router = useRouter()
  // is the text clipped by its max-height on the current screen size?
  // governed by --sn-text-max-height, so we only ask if it's clipping
  const overflowing = useClipped(containerRef)
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

  const Overflow = useMemo(() => {
    if (overflowing && !show) {
      return (
        <Button
          variant='link'
          className='sn-text__show-full p-0 font-bold text-muted'
          aria-expanded='false'
          onClick={showOverflow}
        >
          show more
        </Button>
      )
    }
    return null
  }, [showOverflow, overflowing, show, setShow])

  return { overflowing, show, setShow, Overflow }
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

export function TextBody ({ topLevel, children, className, innerClassName, state, html, imgproxyUrls, rel, name, readerRef }) {
  const containerRef = useRef(null)
  const { overflowing, show, Overflow } = useOverflow({ containerRef })
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
