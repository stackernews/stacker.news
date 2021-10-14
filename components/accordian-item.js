import { Accordion } from 'react-bootstrap'
import ArrowRight from '../svgs/arrow-right-s-fill.svg'
import ArrowDown from '../svgs/arrow-down-s-fill.svg'
import { useEffect, useState } from 'react'

export default function AccordianItem ({ header, body, headerColor = 'grey', show }) {
  const [open, setOpen] = useState(show)

  useEffect(() => {
    setOpen(show)
  }, [])

  return (
    <Accordion
      defaultActiveKey={show ? '0' : undefined}
    >
      <Accordion.Toggle
        as={props => <div {...props} />}
        eventKey='0'
        style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}
        onClick={() => setOpen(!open)}
      >
        {open
          ? <ArrowDown style={{ fill: headerColor }} height={20} width={20} />
          : <ArrowRight style={{ fill: headerColor }} height={20} width={20} />}
        <div style={{ color: headerColor }}>{header}</div>
      </Accordion.Toggle>
      <Accordion.Collapse eventKey='0' className='mt-2'>
        <div>{body}</div>
      </Accordion.Collapse>
    </Accordion>
  )
}
