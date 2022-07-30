import { Form, Input, MarkdownInput, SubmitButton, VariableInput } from '../components/form'
import { useRouter } from 'next/router'
import * as Yup from 'yup'
import { gql, useApolloClient, useMutation } from '@apollo/client'
import ActionTooltip from '../components/action-tooltip'
import Countdown from './countdown'
import AdvPostForm, { AdvPostInitial, AdvPostSchema } from './adv-post-form'
import { MAX_TITLE_LENGTH, MAX_POLL_CHOICE_LENGTH } from '../lib/constants'
import TextareaAutosize from 'react-textarea-autosize'

export function PollForm ({ item, editThreshold }) {
  const router = useRouter()
  const client = useApolloClient()

  const [upsertPoll] = useMutation(
    gql`
      mutation upsertPoll($id: ID, $title: String!, $text: String,
        $options: [String!]!, $boost: Int, $forward: String) {
        upsertPoll(id: $id, title: $title, text: $text,
          options: $options, boost: $boost, forward: $forward) {
          id
        }
      }`
  )

  const PollSchema = Yup.object({
    title: Yup.string().required('required').trim()
      .max(MAX_TITLE_LENGTH,
        ({ max, value }) => `${Math.abs(max - value.length)} too many`),
    options: Yup.array().of(
      Yup.string().trim().test('my-test', 'required', function (value) {
        return (this.path !== 'options[0]' && this.path !== 'options[1]') || value
      }).max(MAX_POLL_CHOICE_LENGTH,
        ({ max, value }) => `${Math.abs(max - value.length)} too many`)
    ),
    ...AdvPostSchema(client)
  })

  return (
    <Form
      initial={{
        title: item?.title || '',
        options: item?.options || ['', ''],
        ...AdvPostInitial
      }}
      schema={PollSchema}
      onSubmit={async ({ boost, title, options, ...values }) => {
        const optionsFiltered = options.filter(word => word.trim().length > 0)
        const { error } = await upsertPoll({
          variables: {
            id: item?.id,
            boost: Number(boost),
            title: title.trim(),
            options: optionsFiltered,
            ...values
          }
        })
        if (error) {
          throw new Error({ message: error.toString() })
        }
        if (item) {
          await router.push(`/items/${item.id}`)
        } else {
          await router.push('/recent')
        }
      }}
      storageKeyPrefix={item ? undefined : 'poll'}
    >
      <Input
        label='title'
        name='title'
        required
      />
      <MarkdownInput
        topLevel
        label={<>text <small className='text-muted ml-2'>optional</small></>}
        name='text'
        as={TextareaAutosize}
        minRows={2}
      />
      <VariableInput
        label='choices'
        name='options'
        max={5}
        hint={editThreshold
          ? <div className='text-muted font-weight-bold'><Countdown date={editThreshold} /></div>
          : null}
      />
      {!item && <AdvPostForm />}
      <ActionTooltip>
        <SubmitButton variant='secondary' className='mt-3'>{item ? 'save' : 'post'}</SubmitButton>
      </ActionTooltip>

    </Form>
  )
}
