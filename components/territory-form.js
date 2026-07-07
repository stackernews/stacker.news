import AccordianItem from './accordian-item'
import { InputGroup, Form as BootstrapForm } from 'react-bootstrap'
import Badge from '@/components/ui/badge'
import { Checkbox, CheckboxGroup, Form, Input, SNInput, Range } from './form'
import { useFormikContext } from 'formik'
import FeeButton, { FeeButtonProvider } from './fee-button'
import { gql } from '@apollo/client'
import { useApolloClient, useLazyQuery } from '@apollo/client/react'
import { useCallback, useMemo, useState } from 'react'
import { useRouter } from 'next/router'
import { MAX_TERRITORY_DESC_LENGTH, POST_TYPES, DOMAIN_BETA_IDS, TERRITORY_BILLING_OPTIONS, TERRITORY_PERIOD_COST } from '@/lib/constants'
import { territorySchema } from '@/lib/validate'
import { useMe } from './me'
import Info from './info'
import { abbrNum } from '@/lib/format'
import { purchasedType } from '@/lib/territory'
import { SUB } from '@/fragments/subs'
import TerritoryBranding, { useBranding } from './territory-branding'
import Link from 'next/link'
import usePayInMutation from '@/components/payIn/hooks/use-pay-in-mutation'
import { UNARCHIVE_TERRITORY, UPSERT_SUB } from '@/fragments/payIn'
import LinkExternal from '@/svgs/link-external.svg'
import { isAbortError } from '@/lib/error'

function SatFilterRanges () {
  const { values } = useFormikContext()
  const baseCost = values.baseCost || 1

  return (
    <Range
      label={
        <div className='flex items-center'>posts sat filter
          <Info>
            <ul>
              <li>minimum net investment (cost + zaps + boost - downzaps) for posts to appear in lit/top</li>
              <li>must be at least the post cost ({baseCost} sats)</li>
            </ul>
          </Info>
        </div>
      }
      name='postsSatsFilter'
      min={baseCost}
      max={1000}
      suffix=' sats'
    />
  )
}

export default function TerritoryForm ({ sub }) {
  const router = useRouter()
  const client = useApolloClient()
  const { me } = useMe()
  const branding = useBranding()
  const [upsertSub] = usePayInMutation(UPSERT_SUB)
  const [unarchiveTerritory] = usePayInMutation(UNARCHIVE_TERRITORY)

  const schema = territorySchema({ client, me, sub })

  const [fetchSub] = useLazyQuery(SUB)
  const [archived, setArchived] = useState(false)
  const onNameChange = useCallback(async (formik, e) => {
    // never show "territory archived" warning during edits
    if (sub) return
    const name = e.target.value
    try {
      const { data } = await fetchSub({ variables: { sub: name } })
      setArchived(data?.sub?.status === 'STOPPED')
    } catch (err) {
      !isAbortError(err) && console.error(err)
    }
  }, [fetchSub, setArchived])

  const onSubmit = useCallback(
    async ({ ...variables }) => {
      const { error, payError } = archived
        ? await unarchiveTerritory({ variables })
        : await upsertSub({ variables: { oldName: sub?.name, ...variables } })

      if (error) throw error
      if (payError) return

      // modify graphql cache to include new sub
      client.cache.modify({
        fields: {
          subs (existing = [], { readField }) {
            const newSubRef = client.cache.writeFragment({
              data: { __typename: 'Sub', name: variables.name },
              fragment: gql`
                fragment SubSubmitFragment on Sub {
                  name
                }`
            })
            if (existing.some(ref => readField('name', ref) === variables.name)) {
              return existing
            }
            return [...existing, newSubRef]
          }
        }
      })

      await router.push(`/~${variables.name}`)
    }, [client, upsertSub, unarchiveTerritory, router, archived]
  )

  const [billing, setBilling] = useState((sub?.billingType || 'MONTHLY').toLowerCase())
  const lineItems = useMemo(() => {
    const lines = { territory: TERRITORY_BILLING_OPTIONS('first')[billing] }
    if (!sub) return lines

    // we are changing billing type so prorate the change
    if (sub?.billingType?.toLowerCase() !== billing) {
      const alreadyBilled = TERRITORY_PERIOD_COST(purchasedType(sub))
      lines.paid = {
        term: `- ${abbrNum(alreadyBilled)} sats`,
        label: 'already paid',
        op: '-',
        modifier: cost => cost - alreadyBilled
      }
      return lines
    }
  }, [sub, billing])

  return (
    <FeeButtonProvider baseLineItems={lineItems}>
      <Form
        initial={{
          name: sub?.name || '',
          desc: sub?.desc || '',
          baseCost: sub?.baseCost || 10,
          replyCost: sub?.replyCost || 1,
          // Default sat filter to match the post cost
          postsSatsFilter: sub?.postsSatsFilter ?? sub?.baseCost ?? 10,
          postTypes: sub?.postTypes || POST_TYPES,
          billingType: sub?.billingType || 'MONTHLY',
          billingAutoRenew: sub?.billingAutoRenew || false,
          nsfw: sub?.nsfw || false
        }}
        schema={schema}
        onSubmit={onSubmit}
        className='mb-12'
        storageKeyPrefix={sub ? undefined : 'territory'}
      >
        <Input
          label='name'
          name='name'
          required
          autoFocus
          clear
          maxLength={32}
          prepend={<InputGroup.Text className='font-mono'>~</InputGroup.Text>}
          onChange={onNameChange}
          warn={archived && (
            <div className='flex items-center'>this territory is archived
              <Info>
                <ul>
                  <li>This territory got archived because the previous founder did not pay for the upkeep</li>
                  <li>You can proceed but will inherit the old content</li>
                </ul>
              </Info>
            </div>
          )}
        />
        <SNInput
          label='description'
          name='desc'
          lengthOptions={{ maxLength: MAX_TERRITORY_DESC_LENGTH, show: true }}
          required
          minRows={3}
          topLevel
        />
        <Input
          label='post cost'
          name='baseCost'
          type='number'
          required
          append={<InputGroup.Text className='font-mono'>sats</InputGroup.Text>}
        />
        <CheckboxGroup label='post types' name='postTypes'>
          <div className='grid grid-cols-3 sm:flex sm:flex-wrap sm:gap-x-8'>
            <div>
              <Checkbox
                inline
                label='links'
                value='LINK'
                name='postTypes'
                id='links-checkbox'
                groupClassName='ms-1 mb-0'
              />
            </div>
            <div>
              <Checkbox
                inline
                label='discussions'
                value='DISCUSSION'
                name='postTypes'
                id='discussions-checkbox'
                groupClassName='ms-1 mb-0'
              />
            </div>
            <div>
              <Checkbox
                inline
                label='bounties'
                value='BOUNTY'
                name='postTypes'
                id='bounties-checkbox'
                groupClassName='ms-1 mb-0'
              />
            </div>
            <div>
              <Checkbox
                inline
                label='polls'
                value='POLL'
                name='postTypes'
                id='polls-checkbox'
                groupClassName='ms-1 mb-0'
              />
            </div>
          </div>
        </CheckboxGroup>
        {sub?.billingType !== 'ONCE' &&
          <>
            <CheckboxGroup
              label={
                <span className='flex items-center'>billing
                  {sub && sub.billingType !== 'ONCE' &&
                    <Info>
                      You will be credited what you paid for your current billing period when you change your billing period to a longer duration.
                      If you change from yearly to monthly, when your year ends, your monthly billing will begin.
                    </Info>}
                </span>
              }
              name='billing'
              groupClassName={billing !== 'once' ? 'mb-0' : ''}
            >
              <Checkbox
                type='radio'
                label={`${abbrNum(TERRITORY_PERIOD_COST('MONTHLY'))} sats/month`}
                value='MONTHLY'
                name='billingType'
                id='monthly-checkbox'
                handleChange={checked => checked && setBilling('monthly')}
                groupClassName='ms-1 mb-0'
              />
              <Checkbox
                type='radio'
                label={`${abbrNum(TERRITORY_PERIOD_COST('YEARLY'))} sats/year`}
                value='YEARLY'
                name='billingType'
                id='yearly-checkbox'
                handleChange={checked => checked && setBilling('yearly')}
                groupClassName='ms-1 mb-0'
              />
              <Checkbox
                type='radio'
                label={`${abbrNum(TERRITORY_PERIOD_COST('ONCE'))} sats once`}
                value='ONCE'
                name='billingType'
                id='once-checkbox'
                handleChange={checked => checked && setBilling('once')}
                groupClassName='ms-1 mb-0'
              />
            </CheckboxGroup>
            {billing !== 'once' &&
              <Checkbox
                label='auto-renew'
                name='billingAutoRenew'
                groupClassName='ms-1 mt-2'
              />}
          </>}
        <AccordianItem
          header={<div style={{ fontWeight: 'bold', fontSize: '92%' }}>options</div>}
          body={
            <>
              <Input
                label='reply cost'
                name='replyCost'
                type='number'
                required
                append={<InputGroup.Text className='font-mono'>sats</InputGroup.Text>}
              />
              <SatFilterRanges />
              <BootstrapForm.Label>nsfw</BootstrapForm.Label>
              <Checkbox
                inline
                label={
                  <div className='flex items-center'>mark as nsfw
                    <Info>
                      <ol>
                        <li>Let stackers know that your territory may contain explicit content</li>
                        <li>Your territory will get a <Badge variant='secondary'>nsfw</Badge> badge</li>
                      </ol>
                    </Info>
                  </div>
          }
                name='nsfw'
                groupClassName='ms-1'
              />
            </>

}
        />
        <div className='mt-4 flex justify-end'>
          <FeeButton
            text={sub ? 'save' : 'found it'}
            variant='secondary'
            disabled={sub?.status === 'STOPPED'}
          />
        </div>
      </Form>
      {DOMAIN_BETA_IDS.includes(Number(me?.id)) &&
        <>
          {sub && !branding && <TerritoryBranding sub={sub} />}
          {sub && branding && <Link className='text-muted w-full' href={`${process.env.NEXT_PUBLIC_URL}/~${sub.name}/edit`}>domain and branding settings on stacker.news <LinkExternal width={16} height={16} /></Link>}
        </>}
    </FeeButtonProvider>
  )
}
