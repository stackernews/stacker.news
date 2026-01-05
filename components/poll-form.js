import { Checkbox, DateTimeInput, Form, Input, SNInput, VariableInput } from '@/components/form'
import AdvPostForm from './adv-post-form'
import { MAX_POLL_CHOICE_LENGTH, MAX_POLL_NUM_CHOICES, MAX_TITLE_LENGTH } from '@/lib/constants'
import { datePivot } from '@/lib/time'
import { pollSchema } from '@/lib/validate'
import { ItemButtonBar } from './post'
import { UPSERT_POLL } from '@/fragments/payIn'
import { usePostFormShared } from './use-post-form-shared'

export function PollForm ({ item, subs, EditInfo, children }) {
  const initialOptions = item?.poll?.options.map(i => i.option)

  const { initial, onSubmit, storageKeyPrefix, schema } = usePostFormShared({
    item,
    subs,
    mutation: UPSERT_POLL,
    schemaFn: pollSchema,
    storageKeyPrefix: 'poll',
    extraInitialValues: {
      options: initialOptions || ['', ''],
      randPollOptions: item?.poll?.randPollOptions || false,
      pollExpiresAt: item ? item.pollExpiresAt : datePivot(new Date(), { hours: 48 })
    }
  })

  return (
    <Form
      initial={initial}
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
      <SNInput
        topLevel
        label={<>text <small className='text-muted ms-2'>optional</small></>}
        name='text'
        minRows={2}
        itemId={item?.id}
      />
      <VariableInput
        label='choices'
        name='options'
        readOnlyLen={initialOptions?.length}
        max={MAX_POLL_NUM_CHOICES}
        min={2}
        hint={EditInfo}
        maxLength={MAX_POLL_CHOICE_LENGTH}
      />
      <AdvPostForm storageKeyPrefix={storageKeyPrefix} item={item}>
        <DateTimeInput
          isClearable
          label='poll expiration'
          name='pollExpiresAt'
          className='pr-4'
          groupClassName='mb-0'
        />
        <Checkbox
          label={<div className='d-flex align-items-center'>randomize order of poll choices</div>}
          name='randPollOptions'
        />
      </AdvPostForm>
      <ItemButtonBar itemId={item?.id} />
    </Form>
  )
}
