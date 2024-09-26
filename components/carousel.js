import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import classNames from 'classnames'
import ArrowLeft from '@/svgs/arrow-left-line.svg'
import ArrowRight from '@/svgs/arrow-right-line.svg'
import styles from './carousel.module.css'
import { useShowModal } from './modal'
import { Dropdown } from 'react-bootstrap'

export default function Carousel ({ close, mediaArr, src, originalSrc, setOptions }) {
  const [index, setIndex] = useState(mediaArr.findIndex(([key]) => key === src))

  const [currentSrc, canGoLeft, canGoRight] = useMemo(() => {
    return [mediaArr[index][0], index > 0, index < mediaArr.length - 1]
  }, [mediaArr, index])

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
        setIndex(i => Math.max(0, i - 1))
      } else if (diff < -50) {
        setIndex(i => Math.min(mediaArr.length - 1, i + 1))
      }
      setTouchStartX(null)
    }
  }, [touchStartX, mediaArr.length, setIndex])

  useEffect(() => {
    document.addEventListener('touchstart', onTouchStart)
    document.addEventListener('touchend', onTouchEnd)
    return () => {
      document.removeEventListener('touchstart', onTouchStart)
      document.removeEventListener('touchend', onTouchEnd)
    }
  }, [onTouchStart, onTouchEnd])

  const onKeyDown = useCallback((e) => {
    if (e.key === 'ArrowLeft') {
      setIndex(i => Math.max(0, i - 1))
    } else if (e.key === 'ArrowRight') {
      setIndex(i => Math.min(mediaArr.length - 1, i + 1))
    }
  }, [mediaArr, setIndex])

  useEffect(() => {
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onKeyDown])

  return (
    <div className={styles.fullScreenContainer} onClick={close}>
      <img className={styles.fullScreen} src={currentSrc} />
      <div className={styles.fullScreenNavContainer}>
        <div
          className={classNames(styles.fullScreenNav, !canGoLeft && 'invisible', styles.left)}
          onClick={(e) => {
            e.stopPropagation()
            setIndex(i => Math.max(0, i - 1))
          }}
        >
          <ArrowLeft width={34} height={34} />
        </div>
        <div
          className={classNames(styles.fullScreenNav, !canGoRight && 'invisible', styles.right)}
          onClick={(e) => {
            e.stopPropagation()
            setIndex(i => Math.min(mediaArr.length - 1, i + 1))
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
  const media = useRef(new Map())
  const showModal = useShowModal()

  const showCarousel = useCallback(({ src }) => {
    showModal((close, setOptions) => {
      return <Carousel close={close} mediaArr={Array.from(media.current.entries())} src={src} setOptions={setOptions} />
    }, {
      fullScreen: true,
      overflow: <CarouselOverflow {...media.current.get(src)} />
    })
  }, [showModal, media.current])

  const addMedia = useCallback(({ src, originalSrc, rel }) => {
    media.current.set(src, { src, originalSrc, rel })
  }, [media.current])

  const value = useMemo(() => ({ showCarousel, addMedia }), [showCarousel, addMedia])
  return <CarouselContext.Provider value={value}>{children}</CarouselContext.Provider>
}

export function useCarousel () {
  return useContext(CarouselContext)
}
