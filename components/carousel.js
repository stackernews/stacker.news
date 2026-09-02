import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import classNames from 'classnames'
import ArrowLeft from '@/svgs/arrow-left-line.svg'
import ArrowRight from '@/svgs/arrow-right-line.svg'
import styles from './carousel.module.css'
import { useShowModal } from './modal'
import { MenuItem } from '@/components/ui/menu'

function useSwiping ({ moveLeft, moveRight }) {
  const [touchStartX, setTouchStartX] = useState(null)

  const onTouchStart = useCallback((e) => {
    if (e.touches.length === 1) {
      setTouchStartX(e.touches[0].clientX)
    }
  }, [])

  const onTouchEnd = useCallback((e) => {
    if (touchStartX !== null) {
      const touchEndX = e.changedTouches[0].clientX
      const diff = touchEndX - touchStartX
      if (diff > 50) {
        moveLeft()
      } else if (diff < -50) {
        moveRight()
      }
      setTouchStartX(null)
    }
  }, [touchStartX, moveLeft, moveRight])

  useEffect(() => {
    document.addEventListener('touchstart', onTouchStart)
    document.addEventListener('touchend', onTouchEnd)
    return () => {
      document.removeEventListener('touchstart', onTouchStart)
      document.removeEventListener('touchend', onTouchEnd)
    }
  }, [onTouchStart, onTouchEnd])
}

// listen on the container, not document: Dialog.Popup stops propagation of arrow keys
function useArrowKeys (ref, { moveLeft, moveRight }) {
  const onKeyDown = useCallback((e) => {
    if (e.key === 'ArrowLeft') {
      moveLeft()
    } else if (e.key === 'ArrowRight') {
      moveRight()
    }
  }, [moveLeft, moveRight])

  useEffect(() => {
    const el = ref.current
    el?.addEventListener('keydown', onKeyDown)
    return () => el?.removeEventListener('keydown', onKeyDown)
  }, [ref, onKeyDown])
}

function Carousel ({ close, mediaArr, src, setOptions }) {
  const [index, setIndex] = useState(mediaArr.findIndex(([key]) => key === src))
  const [currentSrc, canGoLeft, canGoRight] = useMemo(() => {
    if (index === -1) return [src, false, false]
    return [mediaArr[index][0], index > 0, index < mediaArr.length - 1]
  }, [src, mediaArr, index])

  useEffect(() => {
    if (index === -1) return
    setOptions({
      overflow: <CarouselOverflow {...mediaArr[index][1]} />
    })
  }, [index, mediaArr, setOptions])

  const moveLeft = useCallback(() => {
    setIndex(i => Math.max(0, i - 1))
  }, [setIndex])

  const moveRight = useCallback(() => {
    setIndex(i => Math.min(mediaArr.length - 1, i + 1))
  }, [setIndex, mediaArr.length])

  // focus the container so arrow keys land on it, tabIndex -1 keeps it out of the tab order
  const containerRef = useRef(null)
  useEffect(() => { containerRef.current?.focus() }, [])

  useSwiping({ moveLeft, moveRight })
  useArrowKeys(containerRef, { moveLeft, moveRight })

  return (
    <div ref={containerRef} tabIndex={-1} className={styles.fullScreenContainer} onClick={close}>
      <img className={styles.fullScreen} src={currentSrc} />
      <div className={styles.fullScreenNavContainer}>
        <div
          className={classNames(styles.fullScreenNav, !canGoLeft && 'invisible', styles.left)}
          onClick={(e) => {
            e.stopPropagation()
            moveLeft()
          }}
        >
          <ArrowLeft width={34} height={34} />
        </div>
        <div
          className={classNames(styles.fullScreenNav, !canGoRight && 'invisible', styles.right)}
          onClick={(e) => {
            e.stopPropagation()
            moveRight()
          }}
        >
          <ArrowRight width={34} height={34} />
        </div>
      </div>
    </div>
  )
}

const CarouselContext = createContext()

function CarouselOverflow ({ originalSrc, rel }) {
  return <MenuItem href={originalSrc} rel={rel} target='_blank'>view original</MenuItem>
}

export function CarouselProvider ({ children }) {
  const media = useRef(new Map())
  const showModal = useShowModal()

  const showCarousel = useCallback(({ src }) => {
    // only show confirmed entries
    const confirmedEntries = Array.from(media.current.entries())
      .filter(([, entry]) => entry.confirmed)

    showModal((close, setOptions) => {
      return <Carousel close={close} mediaArr={confirmedEntries} src={src} setOptions={setOptions} />
    }, {
      fullScreen: true,
      overflow: <CarouselOverflow {...media.current.get(src)} />
    })
  }, [showModal])

  const addMedia = useCallback(({ src, originalSrc, rel }) => {
    media.current.set(src, { src, originalSrc, rel, confirmed: false })
  }, [])

  const confirmMedia = useCallback((src) => {
    const mediaItem = media.current.get(src)
    if (mediaItem) {
      mediaItem.confirmed = true
      media.current.set(src, mediaItem)
    }
  }, [])

  const removeMedia = useCallback((src) => {
    media.current.delete(src)
  }, [])

  const value = useMemo(
    () => ({ showCarousel, addMedia, confirmMedia, removeMedia }),
    [showCarousel, addMedia, confirmMedia, removeMedia]
  )
  return <CarouselContext.Provider value={value}>{children}</CarouselContext.Provider>
}

const noop = () => {}

const NOOP_CAROUSEL = {
  showCarousel: noop,
  addMedia: noop,
  confirmMedia: noop,
  removeMedia: noop
}

export function useCarousel () {
  return useContext(CarouselContext)
}

/**
 * returns the carousel context if we're not in an editable context,
 * otherwise returns NOOP_CAROUSEL
 *
 * @param {boolean} editable - whether the rich editor is editable
 * @returns {Object} carousel context
 */
export function useEditableCarousel (editable) {
  const carousel = useCarousel()
  if (editable || !carousel) return NOOP_CAROUSEL
  return carousel
}
