import { Form, Input, MarkdownInput } from '../components/form'
import { useRouter } from 'next/router'
import { gql, useApolloClient, useMutation } from '@apollo/client'
import Countdown from './countdown'
import AdvPostForm, { AdvPostInitial } from './adv-post-form'
import InputGroup from 'react-bootstrap/InputGroup'
import useCrossposter from './use-crossposter'
import { bountySchema } from '../lib/validate'
import { SubSelectInitial } from './sub-select'
import { useCallback } from 'react'
import { normalizeForwards, toastDeleteScheduled } from '../lib/form'
import { MAX_TITLE_LENGTH } from '../lib/constants'
import { useMe } from './me'
import { useToast } from './toast'
import { ItemButtonBar } from './post'

export function BountyForm ({
  item,
  sub,
  editThreshold,
  titleLabel = 'title',
  bountyLabel = 'bounty',
  textLabel = 'text',
  handleSubmit,
  children
}) {
  const router = useRouter()
  const client = useApolloClient()
  const me = useMe()
  const toaster = useToast()
  const crossposter = useCrossposter()
  const schema = bountySchema({ client, me, existingBoost: item?.boost })
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
          deleteScheduledAt
        }
      }
    `
  )

  const [updateNoteId] = useMutation(
    gql`
      mutation updateNoteId($id: ID!, $noteId: String!) {
        updateNoteId(id: $id, noteId: $noteId) {
          id
          noteId
        }
      }`
  )

  const onSubmit = useCallback(
    async ({ boost, bounty, crosspost, ...values }) => {
      const { data, error } = await upsertBounty({
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

      const bountyId = data?.upsertBounty?.id

      if (crosspost && bountyId) {
        values.bounty = bounty ? Number(bounty) : undefined
        await crossposter(values, bountyId)
      }

      if (item) {
        await router.push(`/items/${item.id}`)
      } else {
        const prefix = sub?.name ? `/~${sub.name}` : ''
        await router.push(prefix + '/recent')
      }
      toastDeleteScheduled(toaster, data, 'upsertBounty', !!item, values.text)
    }, [upsertBounty, router]
  )

  return (
    <Form
      initial={{
        title: item?.title || '',
        text: item?.text || '',
        crosspost: me?.nostrCrossposting,
        bounty: item?.bounty || 1000,
        ...AdvPostInitial({ forward: normalizeForwards(item?.forwards), boost: item?.boost }),
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
      <Input
        label={titleLabel}
        name='title'
        required
        autoFocus
        clear
        maxLength={MAX_TITLE_LENGTH}
      />
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
      <ItemButtonBar itemId={item?.id} canDelete={false} />
    </Form>
  )
}
