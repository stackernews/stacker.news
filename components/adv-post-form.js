import AccordianItem from './accordian-item'
import * as Yup from 'yup'
import { Input } from './form'
import { InputGroup } from 'react-bootstrap'

export const AdvPostSchema = {
  boost: Yup.number().typeError('must be a number')
    .min(0, 'must be positive').integer('must be whole')
}

export const AdvPostInitial = {
  boost: 0
}

export default function AdvPostForm () {
  return (
    <AccordianItem
      header={<div style={{ fontWeight: 'bold', fontSize: '92%' }}>options</div>}
      body={
        <Input
          label='boost'
          name='boost'
          hint={<span className='text-muted'>ranks posts higher temporarily based on the amount</span>}
          append={<InputGroup.Text className='text-monospace'>sats</InputGroup.Text>}
        />
      }
    />
  )
}
