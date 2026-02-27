import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import classNames from 'classnames'
import ArrowLeft from '@/svgs/arrow-left-line.svg'
import ArrowRight from '@/svgs/arrow-right-line.svg'
import styles from './carousel.module.css'
import { useShowModal } from './modal'
import { Dropdown } from 'react-bootstrap'

function useAutoFade (initialDelay = 2000) {
  const [isActive, setIsActive] = useState(true)
  const timerRef = useRef()
  const bumpActivity = useCallback(() => {
    setIsActive(true)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => setIsActive(false), initialDelay)
  }, [initialDelay])
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])
  return { isActive, bumpActivity }
}

function useSwiping ({ moveLeft, moveRight, bumpActivity }) {
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
        bumpActivity?.()
      } else if (diff < -50) {
        moveRight()
        bumpActivity?.()
      }
      setTouchStartX(null)
    }
  }, [touchStartX, moveLeft, moveRight, bumpActivity])

  useEffect(() => {
    document.addEventListener('touchstart', onTouchStart)
    document.addEventListener('touchend', onTouchEnd)
    return () => {
      document.removeEventListener('touchstart', onTouchStart)
      document.removeEventListener('touchend', onTouchEnd)
    }
  }, [onTouchStart, onTouchEnd])
}

function useArrowKeys ({ moveLeft, moveRight, bumpActivity }) {
  const onKeyDown = useCallback((e) => {
    if (e.key === 'ArrowLeft') {
      moveLeft()
      bumpActivity?.()
    } else if (e.key === 'ArrowRight') {
      moveRight()
      bumpActivity?.()
    }
  }, [moveLeft, moveRight, bumpActivity])

  useEffect(() => {
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onKeyDown])
}
function CarouselArrow ({ direction, onClick, disabled, onActivity }) {
  const { isActive, bumpActivity } = useAutoFade(2000)
  useEffect(() => {
    onActivity?.(bumpActivity)
  }, [onActivity, bumpActivity])
  const handleClick = (e) => {
    e.stopPropagation()
    bumpActivity()
    onClick?.()
  }
  return (
    <div
      className={classNames(
        styles.fullScreenNav,
        isActive ? styles.navActive : styles.navIdle,
        disabled && 'invisible',
        styles[direction]
      )}
      onClick={handleClick}
    >
      {direction === 'left' ? <ArrowLeft width={34} height={34} /> : <ArrowRight width={34} height={34} />}
    </div>
  )
}

function Carousel ({ close, mediaArr, src, setOptions }) {
  const [index, setIndex] = useState(mediaArr.findIndex(([key]) => key === src))
  const [currentSrc, canGoLeft, canGoRight] = useMemo(() => {
    if (index === -1) return [src, false, false]
    return [mediaArr[index][0], index > 0, index < mediaArr.length - 1]
  }, [src, mediaArr, index])
  const leftArrowActivityRef = useRef()
  const rightArrowActivityRef = useRef()
  const bumpAllArrows = useCallback(() => {
    leftArrowActivityRef.current?.()
    rightArrowActivityRef.current?.()
  }, [])

  useEffect(() => {
    if (index === -1) return
    setOptions({
      overflow: <CarouselOverflow {...mediaArr[index][1]} />
    })
    bumpAllArrows()
  }, [index, mediaArr, setOptions, bumpAllArrows])

  const moveLeft = useCallback(() => {
    setIndex(i => Math.max(0, i - 1))
  }, [setIndex])

  const moveRight = useCallback(() => {
    setIndex(i => Math.min(mediaArr.length - 1, i + 1))
  }, [setIndex, mediaArr.length])

  useSwiping({ moveLeft, moveRight, bumpActivity: bumpAllArrows })
  useArrowKeys({ moveLeft, moveRight, bumpActivity: bumpAllArrows })

  return (
    <div className={styles.fullScreenContainer} onClick={close} onMouseMove={bumpAllArrows} onTouchStart={bumpAllArrows}>
      <img className={styles.fullScreen} src={currentSrc} />
      <div className={styles.fullScreenNavContainer}>
        <CarouselArrow
          direction='left'
          onClick={moveLeft}
          disabled={!canGoLeft}
          onActivity={(bumpFn) => { leftArrowActivityRef.current = bumpFn }}
        />
        <CarouselArrow
          direction='right'
          onClick={moveRight}
          disabled={!canGoRight}
          onActivity={(bumpFn) => { rightArrowActivityRef.current = bumpFn }}
        />
      </div>
    </div>
  )
}

const CarouselContext = createContext()

function CarouselOverflow ({ originalSrc, rel }) {
  return <Dropdown.Item href={originalSrc} rel={rel} target='_blank'>view original</Dropdown.Item>
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

export function useCarousel () {
  return useContext(CarouselContext)
}
