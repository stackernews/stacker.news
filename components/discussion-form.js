import { Form, Input, MarkdownInput } from '../components/form'
import { useRouter } from 'next/router'
import { gql, useApolloClient, useLazyQuery, useMutation } from '@apollo/client'
import Countdown from './countdown'
import AdvPostForm, { AdvPostInitial } from './adv-post-form'
import { ITEM_FIELDS } from '../fragments/items'
import AccordianItem from './accordian-item'
import Item from './item'
import { discussionSchema } from '../lib/validate'
import { SubSelectInitial } from './sub-select'
import { useCallback } from 'react'
import { normalizeForwards, toastDeleteScheduled } from '../lib/form'
import { MAX_TITLE_LENGTH } from '../lib/constants'
import { useMe } from './me'
import useCrossposter from './use-crossposter'
import { useToast } from './toast'
import { ItemButtonBar } from './post'
import { callWithTimeout } from '../lib/nostr'

export function DiscussionForm ({
  item, sub, editThreshold, titleLabel = 'title',
  textLabel = 'text',
  handleSubmit, children
}) {
  const router = useRouter()
  const client = useApolloClient()
  const me = useMe()
  const schema = discussionSchema({ client, me, existingBoost: item?.boost })
  // if Web Share Target API was used
  const shareTitle = router.query.title
  const crossposter = useCrossposter()
  const toaster = useToast()

  const [upsertDiscussion] = useMutation(
    gql`
      mutation upsertDiscussion($sub: String, $id: ID, $title: String!, $text: String, $boost: Int, $forward: [ItemForwardInput], $hash: String, $hmac: String, $noteId: String) {
        upsertDiscussion(sub: $sub, id: $id, title: $title, text: $text, boost: $boost, forward: $forward, hash: $hash, hmac: $hmac, noteId: $noteId) {
          id
          deleteScheduledAt
        }
      }`
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
    async ({ boost, crosspost, ...values }) => {
      try {
        if (crosspost) {
          const pubkey = await callWithTimeout(() => window.nostr.getPublicKey(), 5000)
          if (!pubkey) throw new Error('failed to get pubkey')
        }
      } catch (e) {
        console.log(e)
        throw new Error(`Nostr extension error: ${e.message}`)
      }

      const { data, error } = await upsertDiscussion({
        variables: {
          sub: item?.subName || sub?.name,
          id: item?.id,
          boost: boost ? Number(boost) : undefined,
          ...values,
          forward: normalizeForwards(values.forward)
        }
      })

      if (error) {
        throw new Error({ message: error.toString() })
      }

      let noteId = null
      const discussionId = data?.upsertDiscussion?.id

      try {
        if (crosspost && discussionId) {
          const crosspostResult = await crossposter({ ...values, id: discussionId })
          noteId = crosspostResult?.noteId
          if (noteId) {
            await updateNoteId({
              variables: {
                id: discussionId,
                noteId
              }
            })
          }
        }
      } catch (e) {
        console.error(e)
        toaster.danger('Error crossposting to Nostr', e.message)
      }

      if (eventId) {
        await upsertDiscussion({
          variables: {
            id: discussionId,
            ...values,
            forward: normalizeForwards(values.forward),
            noteId: eventId
          }
        })
      }

      if (item) {
        await router.push(`/items/${item.id}`)
      } else {
        const prefix = sub?.name ? `/~${sub.name}` : ''
        await router.push(prefix + '/recent')
      }
      toastDeleteScheduled(toaster, data, 'upsertDiscussion', !!item, values.text)
    }, [upsertDiscussion, router, item, sub, crossposter]
  )

  const [getRelated, { data: relatedData }] = useLazyQuery(gql`
    ${ITEM_FIELDS}
    query related($title: String!) {
      related(title: $title, minMatch: "75%", limit: 3) {
        items {
          ...ItemFields
        }
      }
    }`)

  const related = relatedData?.related?.items || []

  return (
    <Form
      initial={{
        title: item?.title || shareTitle || '',
        text: item?.text || '',
        crosspost: item ? !!item.noteId : me?.privates?.nostrCrossposting,
        ...AdvPostInitial({ forward: normalizeForwards(item?.forwards), boost: item?.boost }),
        ...SubSelectInitial({ sub: item?.subName || sub?.name })
      }}
      schema={schema}
      invoiceable
      onSubmit={handleSubmit || onSubmit}
      storageKeyPrefix={item ? undefined : 'discussion'}
    >
      {children}
      <Input
        label={titleLabel}
        name='title'
        required
        autoFocus
        clear
        onChange={async (formik, e) => {
          if (e.target.value) {
            getRelated({
              variables: { title: e.target.value }
            })
          }
        }}
        maxLength={MAX_TITLE_LENGTH}
      />
      <MarkdownInput
        topLevel
        label={<>{textLabel} <small className='text-muted ms-2'>optional</small></>}
        name='text'
        minRows={6}
        hint={editThreshold
          ? <div className='text-muted fw-bold'><Countdown date={editThreshold} /></div>
          : null}
      />
      <AdvPostForm edit={!!item} />
      <ItemButtonBar itemId={item?.id} />
      {!item &&
        <div className={`mt-3 ${related.length > 0 ? '' : 'invisible'}`}>
          <AccordianItem
            header={<div style={{ fontWeight: 'bold', fontSize: '92%' }}>similar</div>}
            body={
              <div>
                {related.map((item, i) => (
                  <Item item={item} key={item.id} />
                ))}
              </div>
              }
          />
        </div>}
    </Form>
  )
}
