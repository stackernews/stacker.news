import { Form, Input, MarkdownInput, SubmitButton } from '../components/form'
import { useRouter } from 'next/router'
import * as Yup from 'yup'
import { gql, useMutation } from '@apollo/client'
import ActionTooltip from '../components/action-tooltip'
import TextareaAutosize from 'react-textarea-autosize'
import Countdown from './countdown'
import AdvPostForm, { AdvPostInitial, AdvPostSchema } from './adv-post-form'

export const DiscussionSchema = Yup.object({
  title: Yup.string().required('required').trim(),
  ...AdvPostSchema
})

export function DiscussionForm ({ item, editThreshold }) {
  const router = useRouter()
  const [createDiscussion] = useMutation(
    gql`
      mutation createDiscussion($title: String!, $text: String, $boost: Int) {
        createDiscussion(title: $title, text: $text, boost: $boost) {
          id
        }
      }`
  )
  const [updateDiscussion] = useMutation(
    gql`
      mutation updateDiscussion($id: ID!, $title: String!, $text: String!) {
        updateDiscussion(id: $id, title: $title, text: $text) {
          id
        }
      }`, {
      update (cache, { data: { updateDiscussion } }) {
        cache.modify({
          id: `Item:${item.id}`,
          fields: {
            title () {
              return updateDiscussion.title
            },
            text () {
              return updateDiscussion.text
            }
          }
        })
      }
    }
  )

  return (
    <Form
      initial={{
        title: item?.title || '',
        text: item?.text || '',
        ...AdvPostInitial
      }}
      schema={DiscussionSchema}
      onSubmit={async ({ boost, ...values }) => {
        let id, error
        if (item) {
          ({ data: { updateDiscussion: { id } }, error } = await updateDiscussion({ variables: { ...values, id: item.id } }))
        } else {
          ({ data: { createDiscussion: { id } }, error } = await createDiscussion({ variables: { boost: Number(boost), ...values } }))
        }
        if (error) {
          throw new Error({ message: error.toString() })
        }
        router.push(`/items/${id}`)
      }}
    >
      <Input
        label='title'
        name='title'
        required
        autoFocus
      />
      <MarkdownInput
        label={<>text <small className='text-muted ml-2'>optional</small></>}
        name='text'
        as={TextareaAutosize}
        minRows={4}
        hint={editThreshold
          ? <Countdown date={editThreshold} />
          : null}
      />
      {!item && <AdvPostForm />}
      <div className='d-flex'>
        <ActionTooltip>
          <SubmitButton variant='secondary' className='mt-2 ml-auto'>{item ? 'save' : 'post'}</SubmitButton>
        </ActionTooltip>
      </div>
    </Form>
  )
}
