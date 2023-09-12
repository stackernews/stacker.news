import { Form, Input, MarkdownInput, SubmitButton, VariableInput } from '../components/form'
import { useRouter } from 'next/router'
import { gql, useApolloClient, useMutation } from '@apollo/client'
import Countdown from './countdown'
import AdvPostForm, { AdvPostInitial } from './adv-post-form'
import { MAX_POLL_CHOICE_LENGTH, MAX_POLL_NUM_CHOICES, MAX_TITLE_LENGTH } from '../lib/constants'
import FeeButton, { EditFeeButton } from './fee-button'
import Delete from './delete'
import Button from 'react-bootstrap/Button'
import { pollSchema } from '../lib/validate'
import { SubSelectInitial } from './sub-select-form'
import CancelButton from './cancel-button'
import { useCallback } from 'react'
import { normalizeForwards } from '../lib/form'
import { useMe } from './me'

export function PollForm ({ item, sub, editThreshold, children }) {
  const router = useRouter()
  const client = useApolloClient()
  const me = useMe()
  const schema = pollSchema(client, me)

  const [upsertPoll] = useMutation(
    gql`
      mutation upsertPoll($sub: String, $id: ID, $title: String!, $text: String,
        $options: [String!]!, $boost: Int, $forward: [ItemForwardInput], $hash: String, $hmac: String) {
        upsertPoll(sub: $sub, id: $id, title: $title, text: $text,
          options: $options, boost: $boost, forward: $forward, hash: $hash, hmac: $hmac) {
          id
        }
      }`
  )

  const onSubmit = useCallback(
    async ({ boost, title, options, ...values }) => {
      const optionsFiltered = options.slice(initialOptions?.length).filter(word => word.trim().length > 0)
      const { error } = await upsertPoll({
        variables: {
          id: item?.id,
          sub: item?.subName || sub?.name,
          boost: boost ? Number(boost) : undefined,
          title: title.trim(),
          options: optionsFiltered,
          ...values,
          forward: normalizeForwards(values.forward)
        }
      })
      if (error) {
        throw new Error({ message: error.toString() })
      }
      if (item) {
        await router.push(`/items/${item.id}`)
      } else {
        const prefix = sub?.name ? `/~${sub.name}` : ''
        await router.push(prefix + '/recent')
      }
    }, [upsertPoll, router]
  )

  const initialOptions = item?.poll?.options.map(i => i.option)

  return (
    <Form
      initial={{
        title: item?.title || '',
        text: item?.text || '',
        options: initialOptions || ['', ''],
        ...AdvPostInitial({ forward: normalizeForwards(item?.forwards) }),
        ...SubSelectInitial({ sub: item?.subName || sub?.name })
      }}
      schema={schema}
      invoiceable
      onSubmit={onSubmit}
      storageKeyPrefix={item ? undefined : 'poll'}
    >
      {children}
      <Input
        label='title'
        name='title'
        required
        maxLength={MAX_TITLE_LENGTH}
      />
      <MarkdownInput
        topLevel
        label={<>text <small className='text-muted ms-2'>optional</small></>}
        name='text'
        minRows={2}
      />
      <VariableInput
        label='choices'
        name='options'
        readOnlyLen={initialOptions?.length}
        max={MAX_POLL_NUM_CHOICES}
        min={2}
        hint={editThreshold
          ? <div className='text-muted fw-bold'><Countdown date={editThreshold} /></div>
          : null}
        maxLength={MAX_POLL_CHOICE_LENGTH}
      />
      <AdvPostForm edit={!!item} />
      <div className='mt-3'>
        {item
          ? (
            <div className='d-flex justify-content-between'>
              <Delete itemId={item.id} onDelete={() => router.push(`/items/${item.id}`)}>
                <Button variant='grey-medium'>delete</Button>
              </Delete>
              <div className='d-flex'>
                <CancelButton />
                <EditFeeButton
                  paidSats={item.meSats}
                  parentId={null} text='save' ChildButton={SubmitButton} variant='secondary'
                />
              </div>
            </div>)
          : <FeeButton
              baseFee={1} parentId={null} text='post'
              ChildButton={SubmitButton} variant='secondary'
            />}
      </div>
    </Form>
  )
}
