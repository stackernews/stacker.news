import { useState, useMemo } from 'react'
import { abbrNum, numWithUnits } from '@/lib/format'
import { useMe } from './me'

export default function HiddenWalletSummary ({ abbreviate, fixedWidth }) {
  const { me } = useMe()
  const [hover, setHover] = useState(false)

  const fixedWidthAbbrSats = useMemo(() => {
    const abbr = abbrNum(me.privates?.sats).toString()
    if (abbr.length >= 6) return abbr

    // add leading spaces if abbr is shorter than 6 characters
    return ' '.repeat(6 - abbr.length) + abbr
  }, [me.privates?.sats])

  return (
    <span
      className='text-monospace' style={{ whiteSpace: 'pre-wrap' }} onPointerEnter={() => setHover(true)} onPointerLeave={() => setHover(false)}
    >
      {hover ? (abbreviate ? fixedWidthAbbrSats : numWithUnits(me.privates?.sats, { abbreviate: false, format: true })) : '******'}
    </span>
  )
}
