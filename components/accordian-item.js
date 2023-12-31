import Accordion from 'react-bootstrap/Accordion'
import AccordionContext from 'react-bootstrap/AccordionContext'
import { useAccordionButton } from 'react-bootstrap/AccordionButton'
import ArrowRight from '../svgs/arrow-right-s-fill.svg'
import ArrowDown from '../svgs/arrow-down-s-fill.svg'
import { useContext, useState } from 'react'

function ContextAwareToggle ({ children, headerColor = 'var(--theme-grey)', eventKey }) {
  const { activeEventKey } = useContext(AccordionContext)
  const decoratedOnClick = useAccordionButton(eventKey)

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

export default function AccordianItem ({ header, body, headerColor = 'var(--theme-grey)', show }) {
  return (
    <Accordion defaultActiveKey={show ? '0' : undefined}>
      <ContextAwareToggle eventKey='0'><div style={{ color: headerColor }}>{header}</div></ContextAwareToggle>
      <Accordion.Collapse eventKey='0' className='mt-2'>
        <div>{body}</div>
      </Accordion.Collapse>
    </Accordion>
  )
}

export function AccordianCard ({ header, children, show }) {
  const [open, setOpen] = useState(show)
  const toggleOpen = () => setOpen(open => !open)
  return (
    <Accordion activeKey={open ? '0' : undefined} defaultActiveKey={show ? '0' : undefined} onClick={toggleOpen}>
      <Accordion.Item eventKey='0'>
        <Accordion.Header>{header}</Accordion.Header>
        <Accordion.Body>
          {children}
        </Accordion.Body>
      </Accordion.Item>
    </Accordion>
  )
}
