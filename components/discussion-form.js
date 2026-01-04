import { Form, Input, SNInput } from '@/components/form'
import { gql, useLazyQuery } from '@apollo/client'
import AdvPostForm from './adv-post-form'
import { ITEM_FIELDS } from '@/fragments/items'
import AccordianItem from './accordian-item'
import Item from './item'
import { discussionSchema } from '@/lib/validate'
import { MAX_TITLE_LENGTH } from '@/lib/constants'
import { ItemButtonBar } from './post'
import { UPSERT_DISCUSSION } from '@/fragments/payIn'
import { usePostFormShared } from './use-post-form-shared'

export function DiscussionForm ({
  item, subs, EditInfo, titleLabel = 'title',
  textLabel = 'text',
  handleSubmit, children
}) {
  const { initial, onSubmit, storageKeyPrefix, schema } = usePostFormShared({
    item,
    subs,
    mutation: UPSERT_DISCUSSION,
    storageKeyPrefix: 'discussion',
    schemaFn: discussionSchema
  })

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
      initial={initial}
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
      <SNInput
        topLevel
        label={<>{textLabel} <small className='text-muted ms-2'>optional</small></>}
        name='text'
        minRows={6}
        hint={EditInfo}
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
