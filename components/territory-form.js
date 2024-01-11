import { Col, InputGroup, Row, Form as BootstrapForm, Badge } from 'react-bootstrap'
import { Checkbox, CheckboxGroup, Form, Input, MarkdownInput } from './form'
import FeeButton, { FeeButtonProvider } from './fee-button'
import { gql, useApolloClient, useMutation } from '@apollo/client'
import { useCallback, useState } from 'react'
import { useRouter } from 'next/router'
import { MAX_TERRITORY_DESC_LENGTH, POST_TYPES, TERRITORY_BILLING_OPTIONS } from '../lib/constants'
import { territorySchema } from '../lib/validate'
import { useMe } from './me'
import Info from './info'

export default function TerritoryForm ({ sub }) {
  const router = useRouter()
  const client = useApolloClient()
  const me = useMe()
  const [upsertSub] = useMutation(
    gql`
      mutation upsertSub($oldName: String, $name: String!, $desc: String, $baseCost: Int!,
        $postTypes: [String!]!, $allowFreebies: Boolean!, $billingType: String!,
        $billingAutoRenew: Boolean!, $moderated: Boolean!, $hash: String, $hmac: String) {
          upsertSub(oldName: $oldName, name: $name, desc: $desc, baseCost: $baseCost,
            postTypes: $postTypes, allowFreebies: $allowFreebies, billingType: $billingType,
            billingAutoRenew: $billingAutoRenew, moderated: $moderated, hash: $hash, hmac: $hmac) {
          name
        }
      }`
  )

  const onSubmit = useCallback(
    async ({ ...variables }) => {
      const { error } = await upsertSub({
        variables: { oldName: sub?.name, ...variables }
      })

      if (error) {
        throw new Error({ message: error.toString() })
      }

      // modify graphql cache to include new sub
      client.cache.modify({
        fields: {
          subs (existing = []) {
            const filtered = existing.filter(s => s.name !== variables.name && s.name !== sub?.name)
            return [
              ...filtered,
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
          allowFreebies: typeof sub?.allowFreebies === 'undefined' ? true : sub?.allowFreebies,
          billingType: sub?.billingType || 'MONTHLY',
          billingAutoRenew: sub?.billingAutoRenew || false,
          moderated: sub?.moderated || false
        }}
        schema={territorySchema({ client, me })}
        invoiceable
        onSubmit={onSubmit}
        className='mb-5'
        storageKeyPrefix={sub ? undefined : 'territory'}
      > <Input
        label='name'
        name='name'
        required
        autoFocus
        clear
        maxLength={32}
        prepend={<InputGroup.Text className='text-monospace'>~</InputGroup.Text>}
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
          groupClassName='mb-2'
          required
          append={<InputGroup.Text className='text-monospace'>sats</InputGroup.Text>}
        />
        <Checkbox
          label='allow free posts'
          name='allowFreebies'
          groupClassName='ms-1'
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
