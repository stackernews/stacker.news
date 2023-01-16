import { Form, Input, MarkdownInput, SubmitButton } from '../components/form'
import { useRouter } from 'next/router'
import * as Yup from 'yup'
import { gql, useApolloClient, useLazyQuery, useMutation } from '@apollo/client'
import TextareaAutosize from 'react-textarea-autosize'
import Countdown from './countdown'
import AdvPostForm, { AdvPostInitial, AdvPostSchema } from './adv-post-form'
import { MAX_TITLE_LENGTH } from '../lib/constants'
import FeeButton, { EditFeeButton } from './fee-button'
import { ITEM_FIELDS } from '../fragments/items'
import AccordianItem from './accordian-item'
import Item from './item'
import Delete from './delete'
import { Button } from 'react-bootstrap'

export function DiscussionForm ({
  item, editThreshold, titleLabel = 'title',
  textLabel = 'text', buttonText = 'post',
  adv, handleSubmit
}) {
  const router = useRouter()
  const client = useApolloClient()
  // const me = useMe()
  const [upsertDiscussion] = useMutation(
    gql`
      mutation upsertDiscussion($id: ID, $title: String!, $text: String, $boost: Int, $forward: String) {
        upsertDiscussion(id: $id, title: $title, text: $text, boost: $boost, forward: $forward) {
          id
        }
      }`
  )

  const [getRelated, { data: relatedData }] = useLazyQuery(gql`
  ${ITEM_FIELDS}
  query related($title: String!) {
    related(title: $title, minMatch: "75%", limit: 3) {
      items {
        ...ItemFields
      }
    }
  }`, {
    fetchPolicy: 'network-only'
  })

  const DiscussionSchema = Yup.object({
    title: Yup.string().required('required').trim()
      .max(MAX_TITLE_LENGTH,
        ({ max, value }) => `${Math.abs(max - value.length)} too many`),
    ...AdvPostSchema(client)
  })

  const related = relatedData?.related?.items || []

  // const cost = linkOrImg ? 10 : me?.freePosts ? 0 : 1

  return (
    <Form
      initial={{
        title: item?.title || '',
        text: item?.text || '',
        suggest: '',
        ...AdvPostInitial({ forward: item?.fwdUser?.name })
      }}
      schema={DiscussionSchema}
      onSubmit={handleSubmit || (async ({ boost, ...values }) => {
        const { error } = await upsertDiscussion({
          variables: { id: item?.id, boost: Number(boost), ...values }
        })
        if (error) {
          throw new Error({ message: error.toString() })
        }

        if (item) {
          await router.push(`/items/${item.id}`)
        } else {
          await router.push('/recent')
        }
      })}
      storageKeyPrefix={item ? undefined : 'discussion'}
    >
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
      />
      <MarkdownInput
        topLevel
        label={<>{textLabel} <small className='text-muted ml-2'>optional</small></>}
        name='text'
        as={TextareaAutosize}
        minRows={6}
        hint={editThreshold
          ? <div className='text-muted font-weight-bold'><Countdown date={editThreshold} /></div>
          : null}
      />
      {adv && <AdvPostForm edit={!!item} />}
      <div className='mt-3'>
        {item
          ? (
            <div className='d-flex justify-content-between'>
              <Delete itemId={item.id} onDelete={() => router.push(`/items/${item.id}`)}>
                <Button variant='grey-medium'>delete</Button>
              </Delete>
              <EditFeeButton
                paidSats={item.meSats}
                parentId={null} text='save' ChildButton={SubmitButton} variant='secondary'
              />
            </div>)
          : <FeeButton
              baseFee={1} parentId={null} text={buttonText}
              ChildButton={SubmitButton} variant='secondary'
            />}
      </div>
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
