import { Form, Input, MarkdownInput, VariableInput } from '../components/form'
import { useRouter } from 'next/router'
import { gql, useApolloClient, useMutation } from '@apollo/client'
import Countdown from './countdown'
import AdvPostForm, { AdvPostInitial } from './adv-post-form'
import { MAX_POLL_CHOICE_LENGTH, MAX_POLL_NUM_CHOICES, MAX_TITLE_LENGTH } from '../lib/constants'
import { useFeeButton, uppercaseTitleFeeHandler } from './fee-button'
import { pollSchema } from '../lib/validate'
import { SubSelectInitial } from './sub-select-form'
import { useCallback } from 'react'
import { normalizeForwards, toastDeleteScheduled } from '../lib/form'
import { useMe } from './me'
import { useToast } from './toast'
import { ItemButtonBar } from './post'

export function PollForm ({ item, sub, editThreshold, children }) {
  const router = useRouter()
  const client = useApolloClient()
  const me = useMe()
  const toaster = useToast()
  const schema = pollSchema({ client, me, existingBoost: item?.boost })

  const [upsertPoll] = useMutation(
    gql`
      mutation upsertPoll($sub: String, $id: ID, $title: String!, $text: String,
        $options: [String!]!, $boost: Int, $forward: [ItemForwardInput], $hash: String, $hmac: String) {
        upsertPoll(sub: $sub, id: $id, title: $title, text: $text,
          options: $options, boost: $boost, forward: $forward, hash: $hash, hmac: $hmac) {
          id
          deleteScheduledAt
        }
      }`
  )

  const onSubmit = useCallback(
    async ({ boost, title, options, ...values }) => {
      const optionsFiltered = options.slice(initialOptions?.length).filter(word => word.trim().length > 0)
      const { data, error } = await upsertPoll({
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
      toastDeleteScheduled(toaster, data, !!item, values.text)
    }, [upsertPoll, router]
  )

  const initialOptions = item?.poll?.options.map(i => i.option)
  const feeButton = useFeeButton()

  return (
    <Form
      initial={{
        title: item?.title || '',
        text: item?.text || '',
        options: initialOptions || ['', ''],
        ...AdvPostInitial({ forward: normalizeForwards(item?.forwards), boost: item?.boost }),
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
        onChange={async (formik, e) => {
          if (e.target.value) {
            uppercaseTitleFeeHandler(feeButton, e.target.value, item)
          }
        }}
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
      <ItemButtonBar itemId={item?.id} />
    </Form>
  )
}
