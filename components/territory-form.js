import { Col, InputGroup, Row } from 'react-bootstrap'
import { Checkbox, CheckboxGroup, Form, Input, MarkdownInput } from './form'
import FeeButton, { FeeButtonProvider } from './fee-button'
import { gql, useApolloClient, useMutation } from '@apollo/client'
import { useCallback, useState } from 'react'
import { useRouter } from 'next/router'
import { MAX_TERRITORY_DESC_LENGTH, POST_TYPES, TERRITORY_BILLING_OPTIONS } from '../lib/constants'
import { territorySchema } from '../lib/validate'
import { useMe } from './me'

export default function TerritoryForm ({ sub }) {
  const router = useRouter()
  const client = useApolloClient()
  const me = useMe()
  const [upsertSub] = useMutation(
    gql`
      mutation upsertSub($name: String!, $desc: String, $baseCost: Int!,
        $postTypes: [String!]!, $billingType: String!, $billingAutoRenew: Boolean!,
        $hash: String, $hmac: String) {
          upsertSub(name: $name, desc: $desc, baseCost: $baseCost,
            postTypes: $postTypes, billingType: $billingType,
            billingAutoRenew: $billingAutoRenew, hash: $hash, hmac: $hmac) {
          name
        }
      }`
  )

  const onSubmit = useCallback(
    async ({ ...variables }) => {
      const { error } = await upsertSub({
        variables
      })

      if (error) {
        throw new Error({ message: error.toString() })
      }

      // modify graphql cache to include new sub
      client.cache.modify({
        fields: {
          subs (existing = []) {
            console.log('existing', existing, variables.name)
            return [
              ...existing,
              { __typename: 'Sub', name: variables.name }]
          }
        }
      })

      await router.push(`/~${variables.name}`)
    }, [client, upsertSub, router]
  )

  const [billing, setBilling] = useState((sub?.billingType || 'MONTHLY').toLowerCase())

  return (
    <FeeButtonProvider baseLineItems={sub ? undefined : { territory: TERRITORY_BILLING_OPTIONS('first')[billing] }}>
      <Form
        initial={{
          name: sub?.name || '',
          desc: sub?.desc || '',
          baseCost: sub?.baseCost || 10,
          postTypes: sub?.postTypes || POST_TYPES,
          billingType: sub?.billingType || 'MONTHLY',
          billingAutoRenew: sub?.billingAutoRenew || false
        }}
        schema={territorySchema({ client, me })}
        invoiceable
        onSubmit={onSubmit}
        className='mb-5'
        storageKeyPrefix={sub ? undefined : 'territory'}
      >
        {sub?.name
          ? <Input
            label={<>name <small className='text-muted ms-2'>read only</small></>}
            name='name'
            readOnly
            prepend={<InputGroup.Text className='text-monospace'>~</InputGroup.Text>}
            className='text-muted'
            />
          : <Input
              label='name'
              name='name'
              required
              autoFocus
              clear
              maxLength={32}
              prepend={<InputGroup.Text className='text-monospace'>~</InputGroup.Text>}
            />}
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
                groupClassName='ms-1 mb-0'
              />
            </Col>
            <Col xs={4} sm='auto'>
              <Checkbox
                inline
                label='discussions'
                value='DISCUSSION'
                name='postTypes'
                groupClassName='ms-1 mb-0'
              />
            </Col>
            <Col xs={4} sm='auto'>
              <Checkbox
                inline
                label='bounties'
                value='BOUNTY'
                name='postTypes'
                groupClassName='ms-1 mb-0'
              />
            </Col>
            <Col xs={4} sm='auto'>
              <Checkbox
                inline
                label='polls'
                value='POLL'
                name='postTypes'
                groupClassName='ms-1 mb-0'
              />
            </Col>
          </Row>
        </CheckboxGroup>
        <CheckboxGroup
          label='billing'
          name='billing'
          groupClassName='mb-0'
        >
          {(!sub?.billingType || sub.billingType === 'MONTHLY') &&
            <Checkbox
              type='radio'
              label='100k sats/month'
              value='MONTHLY'
              name='billingType'
              readOnly={!!sub}
              handleChange={checked => checked && setBilling('monthly')}
              groupClassName='ms-1 mb-0'
            />}
          {(!sub?.billingType || sub.billingType === 'YEARLY') &&
            <Checkbox
              type='radio'
              label='1m sats/year'
              value='YEARLY'
              name='billingType'
              readOnly={!!sub}
              handleChange={checked => checked && setBilling('yearly')}
              groupClassName='ms-1 mb-0'
            />}
          {(!sub?.billingType || sub.billingType === 'ONCE') &&
            <Checkbox
              type='radio'
              label='3m sats once'
              value='ONCE'
              name='billingType'
              readOnly={!!sub}
              handleChange={checked => checked && setBilling('once')}
              groupClassName='ms-1 mb-0'
            />}
        </CheckboxGroup>
        {billing !== 'once' &&
          <Checkbox
            label='auto renew'
            name='billingAutoRenew'
            groupClassName='ms-1 mt-2'
          />}
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
