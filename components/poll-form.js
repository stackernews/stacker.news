import { DateTimeInput, Form, Input, MarkdownInput, VariableInput } from '../components/form'
import { useRouter } from 'next/router'
import { gql, useApolloClient, useMutation } from '@apollo/client'
import Countdown from './countdown'
import AdvPostForm, { AdvPostInitial } from './adv-post-form'
import { MAX_POLL_CHOICE_LENGTH, MAX_POLL_NUM_CHOICES, MAX_TITLE_LENGTH } from '../lib/constants'
import { datePivot } from '../lib/time'
import { pollSchema } from '../lib/validate'
import { SubSelectInitial } from './sub-select'
import { useCallback } from 'react'
import { normalizeForwards, toastDeleteScheduled } from '../lib/form'
import useCrossposter from './use-crossposter'
import { useMe } from './me'
import { useToast } from './toast'
import { ItemButtonBar } from './post'

export function PollForm ({ item, sub, editThreshold, children }) {
  const router = useRouter()
  const client = useApolloClient()
  const me = useMe()
  const toaster = useToast()
  const schema = pollSchema({ client, me, existingBoost: item?.boost })

  const crossposter = useCrossposter()

  const [upsertPoll] = useMutation(
    gql`
      mutation upsertPoll($sub: String, $id: ID, $title: String!, $text: String,
        $options: [String!]!, $boost: Int, $forward: [ItemForwardInput], $hash: String, $hmac: String, $pollExpiresAt: Date) {
        upsertPoll(sub: $sub, id: $id, title: $title, text: $text,
          options: $options, boost: $boost, forward: $forward, hash: $hash, hmac: $hmac, pollExpiresAt: $pollExpiresAt) {
          id
          deleteScheduledAt
        }
      }`
  )

  const onSubmit = useCallback(
    async ({ boost, title, options, crosspost, ...values }) => {
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

      const pollId = data?.upsertPoll?.id

      if (crosspost && pollId) {
        await crossposter(pollId)
      }

      if (item) {
        await router.push(`/items/${item.id}`)
      } else {
        const prefix = sub?.name ? `/~${sub.name}` : ''
        await router.push(prefix + '/recent')
      }
      toastDeleteScheduled(toaster, data, 'upsertPoll', !!item, values.text)
    }, [upsertPoll, router]
  )

  const initialOptions = item?.poll?.options.map(i => i.option)

  return (
    <Form
      initial={{
        title: item?.title || '',
        text: item?.text || '',
        options: initialOptions || ['', ''],
        crosspost: item ? !!item.noteId : me?.privates?.nostrCrossposting,
        pollExpiresAt: item ? item.pollExpiresAt : datePivot(new Date(), { hours: 25 }),
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
      <AdvPostForm edit={!!item} item={item}>
        <DateTimeInput
          isClearable
          label='poll expiration'
          name='pollExpiresAt'
          className='pr-4'
        />
      </AdvPostForm>
      <ItemButtonBar itemId={item?.id} />
    </Form>
  )
}
