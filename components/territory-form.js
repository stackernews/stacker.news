import AccordianItem from './accordian-item'
import { Col, InputGroup, Row, Form as BootstrapForm, Badge } from 'react-bootstrap'
import { Checkbox, CheckboxGroup, Form, Input, MarkdownInput } from './form'
import FeeButton, { FeeButtonProvider } from './fee-button'
import { gql, useApolloClient, useLazyQuery } from '@apollo/client'
import { useCallback, useMemo, useState } from 'react'
import { useRouter } from 'next/router'
import { MAX_TERRITORY_DESC_LENGTH, POST_TYPES, TERRITORY_BILLING_OPTIONS, TERRITORY_PERIOD_COST } from '@/lib/constants'
import { territorySchema } from '@/lib/validate'
import { useMe } from './me'
import Info from './info'
import { abbrNum } from '@/lib/format'
import { purchasedType } from '@/lib/territory'
import { SUB } from '@/fragments/subs'
import { usePaidMutation } from './use-paid-mutation'
import { UNARCHIVE_TERRITORY, UPSERT_SUB } from '@/fragments/paidAction'

export default function TerritoryForm ({ sub }) {
  const router = useRouter()
  const client = useApolloClient()
  const { me } = useMe()
  const [upsertSub] = usePaidMutation(UPSERT_SUB)
  const [unarchiveTerritory] = usePaidMutation(UNARCHIVE_TERRITORY)

  const schema = territorySchema({ client, me, sub })

  const [fetchSub] = useLazyQuery(SUB)
  const [archived, setArchived] = useState(false)
  const onNameChange = useCallback(async (formik, e) => {
    // never show "territory archived" warning during edits
    if (sub) return
    const name = e.target.value
    const { data } = await fetchSub({ variables: { sub: name } })
    setArchived(data?.sub?.status === 'STOPPED')
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
          postTypes: sub?.postTypes || POST_TYPES,
          billingType: sub?.billingType || 'MONTHLY',
          billingAutoRenew: sub?.billingAutoRenew || false,
          moderated: sub?.moderated || false,
          nsfw: sub?.nsfw || false
        }}
        schema={schema}
        onSubmit={onSubmit}
        className='mb-5'
        storageKeyPrefix={sub ? undefined : 'territory'}
      >
        <Input
          label='name'
          name='name'
          required
          autoFocus
          clear
          maxLength={32}
          prepend={<InputGroup.Text className='text-monospace'>~</InputGroup.Text>}
          onChange={onNameChange}
          warn={archived && (
            <div className='d-flex align-items-center'>this territory is archived
              <Info>
                <ul>
                  <li>This territory got archived because the previous founder did not pay for the upkeep</li>
                  <li>You can proceed but will inherit the old content</li>
                </ul>
              </Info>
            </div>
          )}
        />
        <MarkdownInput
          label='description'
          name='desc'
          maxLength={MAX_TERRITORY_DESC_LENGTH}
          required
          minRows={3}
        />
        <Input
          label='post cost'
          name='baseCost'
          type='number'
          required
          append={<InputGroup.Text className='text-monospace'>sats</InputGroup.Text>}
        />
        <CheckboxGroup label='post types' name='postTypes'>
          <Row>
            <Col xs={4} sm='auto'>
              <Checkbox
                inline
                label='links'
                value='LINK'
                name='postTypes'
                id='links-checkbox'
                groupClassName='ms-1 mb-0'
              />
            </Col>
            <Col xs={4} sm='auto'>
              <Checkbox
                inline
                label='discussions'
                value='DISCUSSION'
                name='postTypes'
                id='discussions-checkbox'
                groupClassName='ms-1 mb-0'
              />
            </Col>
            <Col xs={4} sm='auto'>
              <Checkbox
                inline
                label='bounties'
                value='BOUNTY'
                name='postTypes'
                id='bounties-checkbox'
                groupClassName='ms-1 mb-0'
              />
            </Col>
            <Col xs={4} sm='auto'>
              <Checkbox
                inline
                label='polls'
                value='POLL'
                name='postTypes'
                id='polls-checkbox'
                groupClassName='ms-1 mb-0'
              />
            </Col>
          </Row>
        </CheckboxGroup>
        {sub?.billingType !== 'ONCE' &&
          <>
            <CheckboxGroup
              label={
                <span className='d-flex align-items-center'>billing
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
                append={<InputGroup.Text className='text-monospace'>sats</InputGroup.Text>}
              />
              <BootstrapForm.Label>moderation</BootstrapForm.Label>
              <Checkbox
                inline
                label={
                  <div className='d-flex align-items-center'>enable moderation
                    <Info>
                      <ol>
                        <li>Outlaw posts and comments with a click</li>
                        <li>Your territory will get a <Badge bg='secondary'>moderated</Badge> badge</li>
                      </ol>
                    </Info>
                  </div>
          }
                name='moderated'
                groupClassName='ms-1'
              />
              <BootstrapForm.Label>nsfw</BootstrapForm.Label>
              <Checkbox
                inline
                label={
                  <div className='d-flex align-items-center'>mark as nsfw
                    <Info>
                      <ol>
                        <li>Let stackers know that your territory may contain explicit content</li>
                        <li>Your territory will get a <Badge bg='secondary'>nsfw</Badge> badge</li>
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
        <div className='mt-3 d-flex justify-content-end'>
          <FeeButton
            text={sub ? 'save' : 'found it'}
            variant='secondary'
            disabled={sub?.status === 'STOPPED'}
          />
        </div>
      </Form>
    </FeeButtonProvider>
  )
}
