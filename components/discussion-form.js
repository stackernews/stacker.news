import { Form, Input, MarkdownInput } from '../components/form'
import { useRouter } from 'next/router'
import { gql, useApolloClient, useLazyQuery, useMutation } from '@apollo/client'
import Countdown from './countdown'
import AdvPostForm, { AdvPostInitial } from './adv-post-form'
import { useFeeButton, uppercaseTitleFeeHandler } from './fee-button'
import { ITEM_FIELDS } from '../fragments/items'
import AccordianItem from './accordian-item'
import Item from './item'
import { discussionSchema } from '../lib/validate'
import { SubSelectInitial } from './sub-select-form'
import { useCallback } from 'react'
import { normalizeForwards, toastDeleteScheduled } from '../lib/form'
import { MAX_TITLE_LENGTH } from '../lib/constants'
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
  // if Web Share Target API was used
  const shareTitle = router.query.title
  const crossposter = useCrossposter()
  const toaster = useToast()

  const [upsertDiscussion] = useMutation(
    gql`
      mutation upsertDiscussion($sub: String, $id: ID, $title: String!, $text: String, $boost: Int, $forward: [ItemForwardInput], $hash: String, $hmac: String) {
        upsertDiscussion(sub: $sub, id: $id, title: $title, text: $text, boost: $boost, forward: $forward, hash: $hash, hmac: $hmac) {
          id
          deleteScheduledAt
        }
      }`
  )

  const onSubmit = useCallback(
    async ({ boost, crosspost, ...values }) => {
      try {
        if (crosspost && !(await window.nostr.getPublicKey())) {
          throw new Error('not available')
        }
      } catch (e) {
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

      try {
        if (crosspost && data?.upsertDiscussion?.id) {
          await crossposter({ ...values, id: data.upsertDiscussion.id })
        }
      } catch (e) {
        console.error(e)
      }

      if (item) {
        await router.push(`/items/${item.id}`)
      } else {
        const prefix = sub?.name ? `/~${sub.name}` : ''
        await router.push(prefix + '/recent')
      }
      toastDeleteScheduled(toaster, data, !!item, values.text)
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
  const feeButton = useFeeButton()

  return (
    <Form
      initial={{
        title: item?.title || shareTitle || '',
        text: item?.text || '',
        crosspost: me?.privates?.nostrCrossposting,
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
            uppercaseTitleFeeHandler(feeButton, e.target.value, item)
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
