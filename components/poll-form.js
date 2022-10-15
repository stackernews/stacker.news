import { Form, Input, MarkdownInput, SubmitButton, VariableInput } from '../components/form'
import { useRouter } from 'next/router'
import Yup from './yup'
import { gql, useApolloClient, useMutation } from '@apollo/client'
import Countdown from './countdown'
import AdvPostForm, { AdvPostInitial, AdvPostSchema } from './adv-post-form'
import { MAX_TITLE_LENGTH, MAX_POLL_CHOICE_LENGTH, MAX_POLL_NUM_CHOICES } from '../lib/constants'
import TextareaAutosize from 'react-textarea-autosize'
import FeeButton, { EditFeeButton } from './fee-button'

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
      .maxStrLen(MAX_TITLE_LENGTH,
        ({ max, value }) => `${Math.abs(max - value.length)} too many`),
    options: Yup.array().of(
      Yup.string().trim().test('my-test', 'required', function (value) {
        return (this.path !== 'options[0]' && this.path !== 'options[1]') || value
      }).max(MAX_POLL_CHOICE_LENGTH,
        ({ max, value }) => `${Math.abs(max - value.length)} too many`)
    ),
    ...AdvPostSchema(client)
  })

  const initialOptions = item?.poll?.options.map(i => i.option)

  return (
    <Form
      initial={{
        title: item?.title || '',
        text: item?.text || '',
        options: initialOptions || ['', ''],
        ...AdvPostInitial({ forward: item?.fwdUser?.name })
      }}
      schema={PollSchema}
      onSubmit={async ({ boost, title, options, ...values }) => {
        const optionsFiltered = options.slice(initialOptions?.length).filter(word => word.trim().length > 0)
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
        readOnlyLen={initialOptions?.length}
        max={MAX_POLL_NUM_CHOICES}
        hint={editThreshold
          ? <div className='text-muted font-weight-bold'><Countdown date={editThreshold} /></div>
          : null}
      />
      <AdvPostForm edit={!!item} />
      <div className='mt-3'>
        {item
          ? <EditFeeButton
              paidSats={item.meSats}
              parentId={null} text='save' ChildButton={SubmitButton} variant='secondary'
            />
          : <FeeButton
              baseFee={1} parentId={null} text='post'
              ChildButton={SubmitButton} variant='secondary'
            />}
      </div>
    </Form>
  )
}
