import { useState, useRef, useLayoutEffect } from 'react'
import { abbrNum, numWithUnits } from '../lib/format'
import { useMe } from './me'

export default function HiddenWalletSummary ({ abbreviate, fixedWidth }) {
  const me = useMe()
  const [hover, setHover] = useState(false)

  // prevent layout shifts when hovering by fixing width to initial rendered width
  const ref = useRef()
  const [width, setWidth] = useState(undefined)
  useLayoutEffect(() => {
    setWidth(ref.current?.offsetWidth)
  }, [])

  return (
    <span ref={ref} style={{ width: fixedWidth ? width : undefined }} className='d-inline-block' align='right' onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
      {hover ? (abbreviate ? abbrNum(me.sats) : numWithUnits(me.sats, { abbreviate: false })) : '*****'}
    </span>
  )
}
