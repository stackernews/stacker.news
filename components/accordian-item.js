import Accordion from 'react-bootstrap/Accordion'
import AccordionContext from 'react-bootstrap/AccordionContext'
import { useAccordionButton } from 'react-bootstrap/AccordionButton'
import ArrowRight from '@/svgs/arrow-right-s-fill.svg'
import ArrowDown from '@/svgs/arrow-down-s-fill.svg'
import { useRouter } from 'next/router'
import { useContext, useEffect, useState } from 'react'
import { useFormikContext } from 'formik'

function ContextAwareToggle ({ children, headerColor = 'var(--theme-grey)', eventKey, hasForm }) {
  const router = useRouter()
  const { activeEventKey } = useContext(AccordionContext)
  const formik = hasForm ? useFormikContext() : null
  const [show, setShow] = useState(undefined)
  const decoratedOnClick = useAccordionButton(eventKey)

  useEffect(() => {
    const isDirty = formik?.values.forward?.[0].nym !== '' || formik?.values.forward?.[0].pct !== '' || formik?.values.boost !== '' || (router.query?.type === 'link' && formik?.values.text !== '')

    if (isDirty && hasForm) {
      setShow(false)
    }
  }, [formik?.values])

  useEffect(() => {
    const hasBoostError = !!formik?.errors?.boost && formik?.errors?.boost !== ''
    const hasForwardError = (!!formik?.errors?.forward?.[0].nym && formik?.errors?.forward?.[0].nym !== '') || (!!formik?.errors?.forward?.[0].pct && formik?.errors?.forward?.[0].pct !== '')
    const hasMaxBidError = !!formik?.errors?.maxBid && formik?.errors?.maxBid !== ''

    if (formik?.isSubmitting) {
      setShow(hasForwardError || hasBoostError || hasMaxBidError ? formik?.isSubmitting : undefined)
    }
  }, [formik?.isSubmitting])

  useEffect(() => {
    if (show !== undefined && activeEventKey !== eventKey) {
      decoratedOnClick()
    }
  }, [show])

  const isCurrentEventKey = activeEventKey === eventKey

  return (
    <div style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }} onClick={decoratedOnClick}>
      {isCurrentEventKey
        ? <ArrowDown style={{ fill: headerColor }} height={20} width={20} />
        : <ArrowRight style={{ fill: headerColor }} height={20} width={20} />}
      {children}
    </div>
  )
}

export default function AccordianItem ({ header, body, headerColor = 'var(--theme-grey)', show, hasForm }) {
  return (
    <Accordion defaultActiveKey={show ? '0' : undefined}>
      <ContextAwareToggle hasForm={hasForm} eventKey='0'><div style={{ color: headerColor }}>{header}</div></ContextAwareToggle>
      <Accordion.Collapse eventKey='0' className='mt-2'>
        <div>{body}</div>
      </Accordion.Collapse>
    </Accordion>
  )
}

export function AccordianCard ({ header, children, show }) {
  return (
    <Accordion defaultActiveKey={show ? '0' : undefined}>
      <Accordion.Item eventKey='0'>
        <Accordion.Header>{header}</Accordion.Header>
        <Accordion.Body>
          {children}
        </Accordion.Body>
      </Accordion.Item>
    </Accordion>
  )
}
