import Button from 'react-bootstrap/Button'
import { useFormikContext } from 'formik'
import AccordianItem from './accordian-item'
import { Input, InputUserSuggest, VariableInput } from './form'
import InputGroup from 'react-bootstrap/InputGroup'
import { BOOST_MIN, MAX_FORWARDS } from '../lib/constants'
import Info from './info'
import { numWithUnits } from '../lib/format'

export function AdvPostInitial ({ forward }) {
  return {
    boost: '',
    forward: forward || []
  }
}

export default function AdvPostForm ({ edit }) {
  const formik = useFormikContext()
  return (
    <AccordianItem
      header={<div style={{ fontWeight: 'bold', fontSize: '92%' }}>options</div>}
      body={
        <>
          <Input
            label={
              <div className='d-flex align-items-center'>{edit ? 'add boost' : 'boost'}
                <Info>
                  <ol className='fw-bold'>
                    <li>Boost ranks posts higher temporarily based on the amount</li>
                    <li>The minimum boost is {numWithUnits(BOOST_MIN, { abbreviate: false })}</li>
                    <li>Each {numWithUnits(BOOST_MIN, { abbreviate: false })} of boost is equivalent to one trusted upvote
                      <ul>
                        <li>e.g. {numWithUnits(BOOST_MIN * 2, { abbreviate: false })} is like 2 votes</li>
                      </ul>
                    </li>
                    <li>The decay of boost "votes" increases at 2x the rate of organic votes
                      <ul>
                        <li>i.e. boost votes fall out of ranking faster</li>
                      </ul>
                    </li>
                    <li>100% of sats from boost are given back to top stackers as rewards</li>
                  </ol>
                </Info>
              </div>
            }
            name='boost'
            hint={<span className='text-muted'>ranks posts higher temporarily based on the amount</span>}
            append={<InputGroup.Text className='text-monospace'>sats</InputGroup.Text>}
          />
          <VariableInput
            label='Forward sats to up to 5 other stackers. Any remaining sats go to you.'
            name='forward'
            min={1}
            max={MAX_FORWARDS}
            emptyItem={{ }}
            inputFn={({ index }) => {
              return (
                <div key={index} className='d-flex flex-row' style={{ display: 'flex' }}>
                  <InputUserSuggest
                    label={<>forward sats to</>}
                    name={`forward[${index}].nym`}
                    prepend={<InputGroup.Text>@</InputGroup.Text>}
                    showValid
                    groupClassName='flex-grow-1'
                  />
                  <Input
                    label={<>percent</>}
                    name={`forward[${index}].pct`}
                    showValid
                    type='number'
                    step='1'
                    min='1'
                    max='100'
                    groupClassName='flex-grow-1'
                  />
                </div>
              )
            }}
          />
          {formik.values.forward?.length === 0 && <Button variant='link' onClick={() => formik.setFieldValue('forward', [{}])}>Add stacker</Button>}
        </>
      }
    />
  )
}
