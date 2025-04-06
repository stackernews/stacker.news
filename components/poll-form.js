import { DateTimeInput, Form, Input, MarkdownInput, VariableInput } from '@/components/form'
import { useApolloClient } from '@apollo/client'
import Countdown from './countdown'
import AdvPostForm, { AdvPostInitial } from './adv-post-form'
import { MAX_POLL_CHOICE_LENGTH, MAX_POLL_NUM_CHOICES, MAX_TITLE_LENGTH } from '@/lib/constants'
import { datePivot } from '@/lib/time'
import { pollSchema } from '@/lib/validate'
import { SubSelectInitial } from './sub-select'
import { normalizeForwards } from '@/lib/form'
import { useMe } from './me'
import { ItemButtonBar } from './post'
import { UPSERT_POLL } from '@/fragments/paidAction'
import useItemSubmit from './use-item-submit'

export function PollForm ({ item, sub, editThreshold, children }) {
  const client = useApolloClient()
  const { me } = useMe()
  const schema = pollSchema({ client, me, existingBoost: item?.boost })

  const onSubmit = useItemSubmit(UPSERT_POLL, { item, sub })

  const initialOptions = item?.poll?.options.map(i => i.option)

  const storageKeyPrefix = item ? undefined : 'poll'

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
      onSubmit={onSubmit}
      storageKeyPrefix={storageKeyPrefix}
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
          ? <div className='text-muted fw-bold font-monospace'><Countdown date={editThreshold} /></div>
          : null}
        maxLength={MAX_POLL_CHOICE_LENGTH}
      />
      <AdvPostForm storageKeyPrefix={storageKeyPrefix} item={item} sub={sub}>
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
