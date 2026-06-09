import { Form, Input, SNInput } from '@/components/form'
import AdvPostForm from './adv-post-form'
import InputGroup from 'react-bootstrap/InputGroup'
import { bountySchema } from '@/lib/validate'
import { MAX_TITLE_LENGTH } from '@/lib/constants'
import { ItemButtonBar } from './post'
import { UPSERT_BOUNTY } from '@/fragments/payIn'
import { usePostFormShared } from './use-post-form-shared'

export function BountyForm ({
  item,
  subs,
  EditInfo,
  titleLabel = 'title',
  bountyLabel = 'bounty',
  textLabel = 'text',
  handleSubmit,
  children
}) {
  const { initial, onSubmit, storageKeyPrefix, schema } = usePostFormShared({
    item,
    subs,
    mutation: UPSERT_BOUNTY,
    storageKeyPrefix: 'bounty',
    schemaFn: bountySchema,
    extraInitialValues: { bounty: item?.bounty || 1000 }
  })

  return (
    <Form
      initial={initial}
      schema={schema}
      requireSession
      onSubmit={
        handleSubmit ||
        onSubmit
      }
      storageKeyPrefix={storageKeyPrefix}
    >
      {children}
      <Input
        label={titleLabel}
        name='title'
        required
        autoFocus
        clear
        maxLength={MAX_TITLE_LENGTH}
      />
      <Input
        label={bountyLabel} name='bounty' required
        append={<InputGroup.Text className='text-monospace'>sats</InputGroup.Text>}
      />
      <SNInput
        topLevel
        label={
          <>
            {textLabel} <small className='text-muted ms-2'>optional</small>
          </>
        }
        name='text'
        minRows={6}
        hint={EditInfo}
      />
      <AdvPostForm storageKeyPrefix={storageKeyPrefix} item={item} />
      <ItemButtonBar itemId={item?.id} canDelete={false} />
    </Form>
  )
}
