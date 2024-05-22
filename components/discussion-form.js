import { Form, Input, MarkdownInput } from '@/components/form'
import { useRouter } from 'next/router'
import { gql, useApolloClient, useLazyQuery, useMutation } from '@apollo/client'
import Countdown from './countdown'
import AdvPostForm, { AdvPostInitial } from './adv-post-form'
import { ITEM_FIELDS } from '@/fragments/items'
import AccordianItem from './accordian-item'
import Item from './item'
import { discussionSchema } from '@/lib/validate'
import { SubSelectInitial } from './sub-select'
import { useCallback } from 'react'
import { normalizeForwards, toastUpsertSuccessMessages } from '@/lib/form'
import { MAX_TITLE_LENGTH } from '@/lib/constants'
import { useMe } from './me'
import useCrossposter from './use-crossposter'
import { useToast } from './toast'
import { ItemButtonBar } from './post'

export function DiscussionForm ({
  item, sub, editThreshold, titleLabel = 'title',
  textLabel = 'text',
  handleSubmit, children
}) {
  const router = useRouter()
  const client = useApolloClient()
  const me = useMe()
  const schema = discussionSchema({ client, me, existingBoost: item?.boost })
  const crossposter = useCrossposter()
  const toaster = useToast()

  const queryTitle = router.query.title
  const queryText = router.query.text ? decodeURI(router.query.text) : undefined
  const querySub = router.query.sub
  const queryBoost = router.query.boost

  const [upsertDiscussion] = useMutation(
    gql`
      mutation upsertDiscussion($sub: String, $id: ID, $title: String!, $text: String, $boost: Int, $forward: [ItemForwardInput], $hash: String, $hmac: String) {
        upsertDiscussion(sub: $sub, id: $id, title: $title, text: $text, boost: $boost, forward: $forward, hash: $hash, hmac: $hmac) {
          id
          deleteScheduledAt
          reminderScheduledAt
          invoice {
            id
            bolt11
            hash
            hmac
            expiresAt
            satsRequested
          }
        }
      }`
  )

  const onSubmit = useCallback(
    async ({ boost, crosspost, ...values }) => {
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

      const discussionId = data?.upsertDiscussion?.id

      if (crosspost && discussionId) {
        await crossposter(discussionId)
      }

      if (item) {
        await router.push(`/items/${item.id}`)
      } else {
        const prefix = sub?.name ? `/~${sub.name}` : ''
        await router.push(prefix + '/recent')
      }
      toastUpsertSuccessMessages(toaster, data, 'upsertDiscussion', !!item, values.text)

      return data.upsertDiscussion
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
  const storageKeyPrefix = item ? undefined : 'discussion'
  return (
    <Form
      initial={{
        title: item?.title || queryTitle || '',
        text: item?.text || queryText || '',
        crosspost: item ? !!item.noteId : me?.privates?.nostrCrossposting,
        ...AdvPostInitial({ forward: normalizeForwards(item?.forwards), boost: item?.boost || queryBoost }),
        ...SubSelectInitial({ sub: item?.subName || sub?.name || querySub })
      }}
      schema={schema}
      prepaid
      postpaid
      onSubmit={handleSubmit || onSubmit}
      storageKeyPrefix={storageKeyPrefix}
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
      <AdvPostForm storageKeyPrefix={storageKeyPrefix} item={item} />
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
