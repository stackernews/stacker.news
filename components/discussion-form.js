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

export function DiscussionForm ({
  item, editThreshold, titleLabel = 'title',
  textLabel = 'text', buttonText = 'post',
  adv, handleSubmit
}) {
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
      onSubmit={handleSubmit || (async ({ boost, ...values }) => {
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
      })}
    >
      <Input
        label={titleLabel}
        name='title'
        required
        autoFocus
      />
      <MarkdownInput
        label={<>{textLabel} <small className='text-muted ml-2'>optional</small></>}
        name='text'
        as={TextareaAutosize}
        minRows={6}
        hint={editThreshold
          ? <div className='text-muted font-weight-bold'><Countdown date={editThreshold} /></div>
          : null}
      />
      {!item && adv && <AdvPostForm />}
      <ActionTooltip>
        <SubmitButton variant='secondary' className='mt-3'>{item ? 'save' : buttonText}</SubmitButton>
      </ActionTooltip>
    </Form>
  )
}
