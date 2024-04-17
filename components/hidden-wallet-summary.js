import { useState, useRef } from 'react'
import { abbrNum, numWithUnits } from '@/lib/format'
import { useMe } from './me'

export default function HiddenWalletSummary ({ abbreviate, fixedWidth }) {
  const me = useMe()
  const [hover, setHover] = useState(false)

  const ref = useRef()
  // prevent layout shifts when hovering by fixing width to initial rendered width of '******'
  // We can simply multiply 6 by '0.6em' since monopsace has a fixed width for all characters
  const width = '3.6em'

  return (
    <span
      ref={ref} style={{ display: 'block', minWidth: fixedWidth ? width : undefined, textAlign: 'right' }}
      className='text-monospace' onPointerEnter={() => setHover(true)} onPointerLeave={() => setHover(false)}
    >
      {hover ? (abbreviate ? abbrNum(me.privates?.sats) : numWithUnits(me.privates?.sats, { abbreviate: false, format: true })) : '******'}
    </span>
  )
}
