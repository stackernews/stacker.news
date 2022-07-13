import { Form, Input, MarkdownInput, SubmitButton } from '../components/form'
import { useRouter } from 'next/router'
import * as Yup from 'yup'
import { gql, useApolloClient, useMutation } from '@apollo/client'
import ActionTooltip from '../components/action-tooltip'
import TextareaAutosize from 'react-textarea-autosize'
import Countdown from './countdown'
import AdvPostForm, { AdvPostInitial, AdvPostSchema } from './adv-post-form'
import { MAX_TITLE_LENGTH } from '../lib/constants'

export function DiscussionForm ({
  item, editThreshold, titleLabel = 'title',
  textLabel = 'text', buttonText = 'post',
  adv, handleSubmit
}) {
  const router = useRouter()
  const client = useApolloClient()
  const [upsertDiscussion] = useMutation(
    gql`
      mutation upsertDiscussion($id: ID, $title: String!, $text: String, $boost: Int, $forward: String) {
        upsertDiscussion(id: $id, title: $title, text: $text, boost: $boost, forward: $forward) {
          id
        }
      }`
  )

  const DiscussionSchema = Yup.object({
    title: Yup.string().required('required').trim()
      .max(MAX_TITLE_LENGTH,
        ({ max, value }) => `${Math.abs(max - value.length)} too many`),
    ...AdvPostSchema(client)
  })

  return (
    <Form
      initial={{
        title: item?.title || '',
        text: item?.text || '',
        ...AdvPostInitial
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
      {!item && adv && <AdvPostForm />}
      <ActionTooltip>
        <SubmitButton variant='secondary' className='mt-3'>{item ? 'save' : buttonText}</SubmitButton>
      </ActionTooltip>
    </Form>
  )
}
