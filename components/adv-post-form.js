import AccordianItem from './accordian-item'
import { Input, InputUserSuggest } from './form'
import InputGroup from 'react-bootstrap/InputGroup'
import { BOOST_MIN } from '../lib/constants'
import Info from './info'
import { satsLabel } from '../lib/format'

export function AdvPostInitial ({ forward }) {
  return {
    boost: '',
    forward: forward || ''
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
                    <li>The minimum boost is {satsLabel(BOOST_MIN)}</li>
                    <li>Each {satsLabel(BOOST_MIN)} of boost is equivalent to one trusted upvote
                      <ul>
                        <li>e.g. {satsLabel(BOOST_MIN * 2)} is like 2 votes</li>
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
          <InputUserSuggest
            label={<>forward sats to</>}
            name='forward'
            hint={<span className='text-muted'>100% of sats will be sent to this stacker</span>}
            prepend={<InputGroup.Text>@</InputGroup.Text>}
            showValid
          />
        </>
      }
    />
  )
}
