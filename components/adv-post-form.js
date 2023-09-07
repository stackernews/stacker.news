import AccordianItem from './accordian-item'
import { Input, InputUserSuggest, VariableInput } from './form'
import InputGroup from 'react-bootstrap/InputGroup'
import { BOOST_MIN, MAX_FORWARDS } from '../lib/constants'
import Info from './info'
import { numWithUnits } from '../lib/format'

const EMPTY_FORWARD = { nym: '', pct: '' }

export function AdvPostInitial ({ forward }) {
  return {
    boost: '',
    forward: forward?.length ? forward : [EMPTY_FORWARD]
  }
}

export default function AdvPostForm ({ edit }) {
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
                    <li>The decay of boost &quot;votes&quot; increases at 2x the rate of organic votes
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
            label='forward sats to'
            name='forward'
            min={0}
            max={MAX_FORWARDS}
            emptyItem={EMPTY_FORWARD}
            hint={<span className='text-muted'>Forward sats to up to 5 other stackers. Any remaining sats go to you.</span>}
          >
            {({ index }) => {
              return (
                <div key={index} className='d-flex flex-row'>
                  <InputUserSuggest
                    name={`forward[${index}].nym`}
                    prepend={<InputGroup.Text>@</InputGroup.Text>}
                    showValid
                    groupClassName='flex-grow-1 me-3 mb-0'
                  />
                  <Input
                    name={`forward[${index}].pct`}
                    type='number'
                    step={5}
                    min={1}
                    max={100}
                    style={{ minWidth: '3.5rem' }}
                    append={<InputGroup.Text className='text-monospace'>%</InputGroup.Text>}
                    groupClassName='mb-0'
                    inputGroupClassName='flex-nowrap'
                  />
                </div>
              )
            }}
          </VariableInput>
        </>
      }
    />
  )
}
