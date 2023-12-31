import AccordianItem from './accordian-item'
import { Input, InputUserSuggest, VariableInput, Checkbox } from './form'
import InputGroup from 'react-bootstrap/InputGroup'
import { BOOST_MIN, BOOST_MULT, MAX_FORWARDS } from '../lib/constants'
import { DEFAULT_CROSSPOSTING_RELAYS } from '../lib/nostr'
import Info from './info'
import { numWithUnits } from '../lib/format'
import styles from './adv-post-form.module.css'
import { useMe } from './me'
import { useFeeButton } from './fee-button'

const EMPTY_FORWARD = { nym: '', pct: '' }

export function AdvPostInitial ({ forward, boost }) {
  return {
    boost: boost || '',
    forward: forward?.length ? forward : [EMPTY_FORWARD]
  }
}

export default function AdvPostForm ({ children }) {
  const me = useMe()
  const { merge } = useFeeButton()

  return (
    <AccordianItem
      header={<div style={{ fontWeight: 'bold', fontSize: '92%' }}>options</div>}
      body={
        <>
          {children}
          <Input
            label={
              <div className='d-flex align-items-center'>boost
                <Info>
                  <ol className='fw-bold'>
                    <li>Boost ranks posts higher temporarily based on the amount</li>
                    <li>The minimum boost is {numWithUnits(BOOST_MIN, { abbreviate: false })}</li>
                    <li>Each {numWithUnits(BOOST_MULT, { abbreviate: false })} of boost is equivalent to one trusted upvote
                      <ul>
                        <li>e.g. {numWithUnits(BOOST_MULT * 5, { abbreviate: false })} is like 5 votes</li>
                      </ul>
                    </li>
                    <li>The decay of boost "votes" increases at 1.25x the rate of organic votes
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
            onChange={(_, e) => merge({
              boost: {
                term: `+ ${e.target.value}`,
                label: 'boost',
                modifier: cost => cost + Number(e.target.value)
              }
            })}
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
            {({ index, placeholder }) => {
              return (
                <div key={index} className='d-flex flex-row'>
                  <InputUserSuggest
                    name={`forward[${index}].nym`}
                    prepend={<InputGroup.Text>@</InputGroup.Text>}
                    showValid
                    groupClassName={`${styles.name} me-3 mb-0`}
                  />
                  <Input
                    name={`forward[${index}].pct`}
                    type='number'
                    step={5}
                    min={1}
                    max={100}
                    append={<InputGroup.Text className='text-monospace'>%</InputGroup.Text>}
                    groupClassName={`${styles.percent} mb-0`}
                  />
                </div>
              )
            }}
          </VariableInput>
          {me &&
            <Checkbox
              label={
                <div className='d-flex align-items-center'>crosspost to nostr
                  <Info>
                    <ul className='fw-bold'>
                      <li>crosspost this item to nostr</li>
                      <li>requires NIP-07 extension for signing</li>
                      <li>we use your NIP-05 relays if set</li>
                      <li>otherwise we default to these relays:</li>
                      <ul>
                        {DEFAULT_CROSSPOSTING_RELAYS.map((relay, i) => (
                          <li key={i}>{relay}</li>
                        ))}
                      </ul>
                    </ul>
                  </Info>
                </div>
            }
              name='crosspost'
            />}
        </>
      }
    />
  )
}
