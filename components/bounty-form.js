import { Form, Input, MarkdownInput, SubmitButton } from '../components/form'
import { useRouter } from 'next/router'
import { gql, useApolloClient, useMutation } from '@apollo/client'
import Countdown from './countdown'
import AdvPostForm, { AdvPostInitial } from './adv-post-form'
import FeeButton, { EditFeeButton } from './fee-button'
import InputGroup from 'react-bootstrap/InputGroup'
import { bountySchema } from '../lib/validate'
import { SubSelectInitial } from './sub-select-form'
import CancelButton from './cancel-button'
import { useCallback } from 'react'
import { normalizeForwards } from '../lib/form'

export function BountyForm ({
  item,
  sub,
  editThreshold,
  titleLabel = 'title',
  bountyLabel = 'bounty',
  textLabel = 'text',
  buttonText = 'post',
  handleSubmit,
  children
}) {
  const router = useRouter()
  const client = useApolloClient()
  const schema = bountySchema(client)
  const [upsertBounty] = useMutation(
    gql`
      mutation upsertBounty(
        $sub: String
        $id: ID
        $title: String!
        $bounty: Int!
        $text: String
        $boost: Int
        $forward: [ItemForwardInput]
        $hash: String
        $hmac: String
      ) {
        upsertBounty(
          sub: $sub
          id: $id
          title: $title
          bounty: $bounty
          text: $text
          boost: $boost
          forward: $forward
          hash: $hash
          hmac: $hmac
        ) {
          id
        }
      }
    `
  )

  const onSubmit = useCallback(
    async ({ boost, bounty, ...values }) => {
      const { error } = await upsertBounty({
        variables: {
          sub: item?.subName || sub?.name,
          id: item?.id,
          boost: boost ? Number(boost) : undefined,
          bounty: bounty ? Number(bounty) : undefined,
          ...values,
          forward: normalizeForwards(values.forward)
        }
      })
      if (error) {
        throw new Error({ message: error.toString() })
      }

      if (item) {
        await router.push(`/items/${item.id}`)
      } else {
        const prefix = sub?.name ? `/~${sub.name}` : ''
        await router.push(prefix + '/recent')
      }
    }, [upsertBounty, router]
  )

  return (
    <Form
      initial={{
        title: item?.title || '',
        text: item?.text || '',
        bounty: item?.bounty || 1000,
        ...AdvPostInitial({ forward: normalizeForwards(item?.forwards) }),
        ...SubSelectInitial({ sub: item?.subName || sub?.name })
      }}
      schema={schema}
      invoiceable={{ requireSession: true }}
      onSubmit={
        handleSubmit ||
        onSubmit
      }
      storageKeyPrefix={item ? undefined : 'bounty'}
    >
      {children}
      <Input label={titleLabel} name='title' required autoFocus clear />
      <Input
        label={bountyLabel} name='bounty' required
        append={<InputGroup.Text className='text-monospace'>sats</InputGroup.Text>}
      />
      <MarkdownInput
        topLevel
        label={
          <>
            {textLabel} <small className='text-muted ms-2'>optional</small>
          </>
        }
        name='text'
        minRows={6}
        hint={
          editThreshold
            ? (
              <div className='text-muted fw-bold'>
                <Countdown date={editThreshold} />
              </div>
              )
            : null
        }
      />
      <AdvPostForm edit={!!item} />
      <div className='mt-3'>
        {item
          ? (
            <div className='d-flex'>
              <CancelButton />
              <EditFeeButton
                paidSats={item.meSats}
                parentId={null}
                text='save'
                ChildButton={SubmitButton}
                variant='secondary'
              />
            </div>
            )
          : (
            <FeeButton
              baseFee={1}
              parentId={null}
              text={buttonText}
              ChildButton={SubmitButton}
              variant='secondary'
            />
            )}
      </div>
    </Form>
  )
}
