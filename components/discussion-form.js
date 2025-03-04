import { Form, Input, MarkdownInput } from '@/components/form'
import { useRouter } from 'next/router'
import { gql, useApolloClient, useLazyQuery } from '@apollo/client'
import Countdown from './countdown'
import AdvPostForm, { AdvPostInitial } from './adv-post-form'
import { ITEM_FIELDS } from '@/fragments/items'
import AccordianItem from './accordian-item'
import Item from './item'
import { discussionSchema } from '@/lib/validate'
import { SubSelectInitial } from './sub-select'
import { normalizeForwards } from '@/lib/form'
import { MAX_TITLE_LENGTH } from '@/lib/constants'
import { useMe } from './me'
import { ItemButtonBar } from './post'
import { UPSERT_DISCUSSION } from '@/fragments/paidAction'
import useItemSubmit from './use-item-submit'

export function DiscussionForm ({
  item, sub, editThreshold, titleLabel = 'title',
  textLabel = 'text',
  handleSubmit, children
}) {
  const router = useRouter()
  const client = useApolloClient()
  const { me } = useMe()
  const onSubmit = useItemSubmit(UPSERT_DISCUSSION, { item, sub })
  const schema = discussionSchema({ client, me, existingBoost: item?.boost })
  // if Web Share Target API was used
  const shareTitle = router.query.title
  const shareText = router.query.text ? decodeURI(router.query.text) : undefined

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
        title: item?.title || shareTitle || '',
        text: item?.text || shareText || '',
        crosspost: item ? !!item.noteId : me?.privates?.nostrCrossposting,
        ...AdvPostInitial({ forward: normalizeForwards(item?.forwards), boost: item?.boost }),
        ...SubSelectInitial({ sub: item?.subName || sub?.name })
      }}
      schema={schema}
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
          ? <div className='text-muted fw-bold font-monospace'><Countdown date={editThreshold} /></div>
          : null}
      />
      <AdvPostForm storageKeyPrefix={storageKeyPrefix} item={item} sub={sub} />
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
