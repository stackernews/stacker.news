import { useState, useEffect } from 'react'
import AccordianItem from './accordian-item'
import { Input, InputUserSuggest, VariableInput, Checkbox } from './form'
import InputGroup from 'react-bootstrap/InputGroup'
import { BOOST_MIN, BOOST_MULT, MAX_FORWARDS } from '@/lib/constants'
import { DEFAULT_CROSSPOSTING_RELAYS } from '@/lib/nostr'
import Info from './info'
import { numWithUnits } from '@/lib/format'
import styles from './adv-post-form.module.css'
import { useMe } from './me'
import { useFeeButton } from './fee-button'
import { useRouter } from 'next/router'
import { useFormikContext } from 'formik'

const EMPTY_FORWARD = { nym: '', pct: '' }

export function AdvPostInitial ({ forward, boost }) {
  return {
    boost: boost || '',
    forward: forward?.length ? forward : [EMPTY_FORWARD]
  }
}

const FormStatus = {
  DIRTY: 'dirty',
  ERROR: 'error'
}

export function BoostInput ({ onChange, ...props }) {
  const { merge } = useFeeButton()
  return (
    <Input
      label={
        <div className='d-flex align-items-center'>boost
          <Info>
            <ol>
              <li>Boost ranks item higher temporarily based on the amount</li>
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
      onChange={(_, e) => {
        merge({
          boost: {
            term: `+ ${e.target.value}`,
            label: 'boost',
            modifier: cost => cost + Number(e.target.value)
          }
        })
        onChange && onChange(_, e)
      }}
      hint={<span className='text-muted'>ranks posts higher temporarily based on the amount</span>}
      append={<InputGroup.Text className='text-monospace'>sats</InputGroup.Text>}
      {...props}
    />
  )
}

export default function AdvPostForm ({ children, item, storageKeyPrefix }) {
  const { me } = useMe()
  const router = useRouter()
  const [itemType, setItemType] = useState()
  const formik = useFormikContext()
  const [show, setShow] = useState(false)

  useEffect(() => {
    const isDirty = formik?.values.forward?.[0].nym !== '' || formik?.values.forward?.[0].pct !== '' ||
      formik?.values.boost !== '' || (router.query?.type === 'link' && formik?.values.text !== '')

    // if the adv post form is dirty on first render, show the accordian
    if (isDirty) {
      setShow(FormStatus.DIRTY)
    }

    // HACK ... TODO: we should generically handle this kind of local storage stuff
    // in the form component, overriding the initial values
    if (storageKeyPrefix) {
      for (let i = 0; i < MAX_FORWARDS; i++) {
        ['nym', 'pct'].forEach(key => {
          const value = window.localStorage.getItem(`${storageKeyPrefix}-forward[${i}].${key}`)
          if (value) {
            formik?.setFieldValue(`forward[${i}].${key}`, value)
          }
        })
      }
    }
  }, [formik?.values, storageKeyPrefix])

  useEffect(() => {
    // force show the accordian if there is an error and the form is submitting
    const hasError = !!formik?.errors?.boost || formik?.errors?.forward?.length > 0
    // if it's open we don't want to collapse on submit
    setShow(show => hasError && formik?.isSubmitting ? FormStatus.ERROR : show)
  }, [formik?.isSubmitting])

  useEffect(() => {
    const determineItemType = () => {
      if (router && router.query.type) {
        return router.query.type
      } else if (item) {
        const typeMap = {
          url: 'link',
          bounty: 'bounty',
          pollCost: 'poll'
        }

        for (const [key, type] of Object.entries(typeMap)) {
          if (item[key]) {
            return type
          }
        }

        return 'discussion'
      }
    }

    const type = determineItemType()
    setItemType(type)
  }, [item, router])

  function renderCrosspostDetails (itemType) {
    switch (itemType) {
      case 'discussion':
        return <li>crosspost this discussion as a NIP-23 event</li>
      case 'link':
        return <li>crosspost this link as a NIP-01 event</li>
      case 'bounty':
        return <li>crosspost this bounty as a NIP-99 event</li>
      case 'poll':
        return <li>crosspost this poll as a NIP-41 event</li>
      default:
        return null
    }
  }

  return (
    <AccordianItem
      header={<div style={{ fontWeight: 'bold', fontSize: '92%' }}>options</div>}
      show={show}
      body={
        <>
          {children}
          <BoostInput />
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
          {me && itemType &&
            <Checkbox
              label={
                <div className='d-flex align-items-center'>crosspost to nostr
                  <Info>
                    <ul>
                      {renderCrosspostDetails(itemType)}
                      <li>requires NIP-07 extension for signing</li>
                      <li>we use your NIP-05 relays if set</li>
                      <li>we use these relays by default:</li>
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
