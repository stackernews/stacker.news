import classNames from 'classnames'
import { Button } from 'react-bootstrap'
import ArrowLeft from '@/svgs/arrow-left-line.svg'

import { usePrev, useNext } from '@/components/multi-step-form'

export function BackButton ({ className }) {
  const prev = usePrev()
  return (
    <Button className={classNames('me-3 text-muted nav-link fw-bold', className)} variant='link' onClick={prev}>
      {/* 'theme' adds hover style */}
      <ArrowLeft className='theme' width={24} height={24} />
    </Button>
  )
}

export function SkipButton ({ className }) {
  const next = useNext()
  return <Button className={classNames('ms-auto me-3 text-muted nav-link fw-bold', className)} variant='link' onClick={next}>skip</Button>
}
