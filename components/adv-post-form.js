import { useState, useEffect, useMemo, useCallback } from 'react'
import AccordianItem from './accordian-item'
import { Input, InputUserSuggest, VariableInput, Checkbox } from './form'
import InputGroup from 'react-bootstrap/InputGroup'
import { BOOST_MIN, BOOST_MULT, MAX_FORWARDS, SSR } from '@/lib/constants'
import { DEFAULT_CROSSPOSTING_RELAYS } from '@/lib/nostr'
import Info from './info'
import { abbrNum, numWithUnits } from '@/lib/format'
import styles from './adv-post-form.module.css'
import { useMe } from './me'
import { useFeeButton } from './fee-button'
import { useRouter } from 'next/router'
import { useFormikContext } from 'formik'
import { gql, useQuery } from '@apollo/client'
import useDebounceCallback from './use-debounce-callback'
import { Button } from 'react-bootstrap'
import classNames from 'classnames'

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

export function BoostHelp () {
  return (
    <ol style={{ lineHeight: 1.25 }}>
      <li>Boost ranks items higher based on the amount</li>
      <li>The highest boost in a territory over the last 30 days is pinned to the top of the territory</li>
      <li>The highest boost across all territories over the last 30 days is pinned to the top of the homepage</li>
      <li>The minimum boost is {numWithUnits(BOOST_MIN, { abbreviate: false })}</li>
      <li>Each {numWithUnits(BOOST_MULT, { abbreviate: false })} of boost is equivalent to a zap-vote from a maximally trusted stacker (very rare)
        <ul>
          <li>e.g. {numWithUnits(BOOST_MULT * 5, { abbreviate: false })} is like five zap-votes from a maximally trusted stacker</li>
        </ul>
      </li>
      <li>boost can take a few minutes to show higher ranking in feed</li>
      <li>100% of boost goes to the territory founder and top stackers as rewards</li>
    </ol>
  )
}

export function BoostInput ({ onChange, ...props }) {
  const feeButton = useFeeButton()
  let merge
  if (feeButton) {
    ({ merge } = feeButton)
  }
  return (
    <Input
      label={
        <div className='d-flex align-items-center'>boost
          <Info>
            <BoostHelp />
          </Info>
        </div>
    }
      name='boost'
      onChange={(_, e) => {
        merge?.({
          boost: {
            term: `+ ${e.target.value}`,
            label: 'boost',
            op: '+',
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

const BoostMaxes = ({ subName, homeMax, subMax, boost, updateBoost }) => {
  return (
    <div className='d-flex flex-row mb-2'>
      <Button
        className={classNames(styles.boostMax, 'me-2', homeMax + BOOST_MULT <= (boost || 0) && 'invisible')}
        size='sm'
        onClick={() => updateBoost(homeMax + BOOST_MULT)}
      >
        {abbrNum(homeMax + BOOST_MULT)} <small>top of homepage</small>
      </Button>
      {subName &&
        <Button
          className={classNames(styles.boostMax, subMax + BOOST_MULT <= (boost || 0) && 'invisible')}
          size='sm'
          onClick={() => updateBoost(subMax + BOOST_MULT)}
        >
          {abbrNum(subMax + BOOST_MULT)} <small>top of ~{subName}</small>
        </Button>}
    </div>
  )
}

// act means we are adding to existing boost
export function BoostItemInput ({ item, sub, act = false, ...props }) {
  // act adds boost to existing boost
  const existingBoost = act ? Number(item?.boost || 0) : 0
  const [boost, setBoost] = useState(act ? 0 : Number(item?.boost || 0))

  const { data, previousData, refetch } = useQuery(gql`
    query BoostPosition($sub: String, $id: ID, $boost: Int) {
      boostPosition(sub: $sub, id: $id, boost: $boost) {
        home
        sub
        homeMaxBoost
        subMaxBoost
      }
    }`,
  {
    variables: { sub: item?.subName || sub?.name, boost: existingBoost + boost, id: item?.id },
    fetchPolicy: 'cache-and-network',
    skip: !!item?.parentId || SSR
  })

  const getPositionDebounce = useDebounceCallback((...args) => refetch(...args), 1000, [refetch])
  const updateBoost = useCallback((boost) => {
    const boostToUse = Number(boost || 0)
    setBoost(boostToUse)
    getPositionDebounce({ sub: item?.subName || sub?.name, boost: Number(existingBoost + boostToUse), id: item?.id })
  }, [getPositionDebounce, item?.id, item?.subName, sub?.name, existingBoost])

  const dat = data || previousData

  const boostMessage = useMemo(() => {
    if (!item?.parentId && boost >= BOOST_MULT) {
      if (dat?.boostPosition?.home || dat?.boostPosition?.sub || boost > dat?.boostPosition?.homeMaxBoost || boost > dat?.boostPosition?.subMaxBoost) {
        const boostPinning = []
        if (dat?.boostPosition?.home || boost > dat?.boostPosition?.homeMaxBoost) {
          boostPinning.push('homepage')
        }
        if ((item?.subName || sub?.name) && (dat?.boostPosition?.sub || boost > dat?.boostPosition?.subMaxBoost)) {
          boostPinning.push(`~${item?.subName || sub?.name}`)
        }
        return `pins to the top of ${boostPinning.join(' and ')}`
      }
    }
    return 'ranks posts higher based on the amount'
  }, [boost, dat?.boostPosition?.home, dat?.boostPosition?.sub, item?.subName, sub?.name])

  return (
    <>
      <BoostInput
        hint={<span className='text-muted'>{boostMessage}</span>}
        onChange={(_, e) => {
          if (e.target.value >= 0) {
            updateBoost(Number(e.target.value))
          }
        }}
        overrideValue={boost}
        {...props}
        groupClassName='mb-1'
      />
      {!item?.parentId &&
        <BoostMaxes
          subName={item?.subName || sub?.name}
          homeMax={(dat?.boostPosition?.homeMaxBoost || 0) - existingBoost}
          subMax={(dat?.boostPosition?.subMaxBoost || 0) - existingBoost}
          boost={existingBoost + boost}
          updateBoost={updateBoost}
        />}
    </>
  )
}

export default function AdvPostForm ({ children, item, sub, storageKeyPrefix }) {
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
          <BoostItemInput item={item} sub={sub} />
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
          {me && itemType === 'poll' &&
            <Checkbox
              label={
                <div className='d-flex align-items-center'>randomize order of poll choices
                </div>
            }
              name='randPollOptions'
              checked={formik?.values.randPollOptions}
              onChange={formik.handleChange}
            />}
        </>
      }
    />
  )
}
