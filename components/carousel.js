import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import classNames from 'classnames'
import ArrowLeft from '@/svgs/arrow-left-line.svg'
import ArrowRight from '@/svgs/arrow-right-line.svg'
import styles from './carousel.module.css'
import { useShowModal } from './modal'
import { Dropdown } from 'react-bootstrap'
import { usePathname } from 'next/navigation'

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

function useArrowKeys ({ moveLeft, moveRight }) {
  const onKeyDown = useCallback((e) => {
    if (e.key === 'ArrowLeft') {
      moveLeft()
    } else if (e.key === 'ArrowRight') {
      moveRight()
    }
  }, [moveLeft, moveRight])

  useEffect(() => {
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onKeyDown])
}

export default function Carousel ({ close, mediaArr, src, originalSrc, setOptions }) {
  const [index, setIndex] = useState(mediaArr.findIndex(([key]) => key === src))
  const [currentSrc, canGoLeft, canGoRight] = useMemo(() => {
    return [mediaArr[index][0], index > 0, index < mediaArr.length - 1]
  }, [mediaArr, index])

  const moveLeft = useCallback(() => {
    setIndex(i => Math.max(0, i - 1))
  }, [setIndex])

  const moveRight = useCallback(() => {
    setIndex(i => Math.min(mediaArr.length - 1, i + 1))
  }, [setIndex, mediaArr.length])

  useSwiping({ moveLeft, moveRight })
  useArrowKeys({ moveLeft, moveRight })

  return (
    <div className={styles.fullScreenContainer} onClick={close}>
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
  return <Dropdown.Item href={originalSrc} rel={rel} target='_blank'>view original</Dropdown.Item>
}

export function CarouselProvider ({ children }) {
  const pathname = usePathname()

  const media = useRef(new Map())
  const showModal = useShowModal()

  const showCarousel = useCallback(({ src }) => {
    window.history.pushState(null, '', pathname)

    showModal((close, setOptions) => {
      const closeAction = () => {
        window.history.back()
      }
      return <Carousel close={closeAction} mediaArr={Array.from(media.current.entries())} src={src} setOptions={setOptions} />
    }, {
      fullScreen: true,
      overflow: <CarouselOverflow {...media.current.get(src)} />
    })
  }, [showModal, media.current])

  const addMedia = useCallback(({ src, originalSrc, rel }) => {
    media.current.set(src, { src, originalSrc, rel })
  }, [media.current])

  const removeMedia = useCallback((src) => {
    media.current.delete(src)
  }, [media.current])

  const value = useMemo(() => ({ showCarousel, addMedia, removeMedia }), [showCarousel, addMedia, removeMedia])
  return <CarouselContext.Provider value={value}>{children}</CarouselContext.Provider>
}

export function useCarousel () {
  return useContext(CarouselContext)
}
