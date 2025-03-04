import { Form, Input, MarkdownInput } from '@/components/form'
import { useApolloClient } from '@apollo/client'
import Countdown from './countdown'
import AdvPostForm, { AdvPostInitial } from './adv-post-form'
import InputGroup from 'react-bootstrap/InputGroup'
import { bountySchema } from '@/lib/validate'
import { SubSelectInitial } from './sub-select'
import { normalizeForwards } from '@/lib/form'
import { MAX_TITLE_LENGTH } from '@/lib/constants'
import { useMe } from './me'
import { ItemButtonBar } from './post'
import useItemSubmit from './use-item-submit'
import { UPSERT_BOUNTY } from '@/fragments/paidAction'

export function BountyForm ({
  item,
  sub,
  editThreshold,
  titleLabel = 'title',
  bountyLabel = 'bounty',
  textLabel = 'text',
  handleSubmit,
  children
}) {
  const client = useApolloClient()
  const { me } = useMe()
  const schema = bountySchema({ client, me, existingBoost: item?.boost })

  const onSubmit = useItemSubmit(UPSERT_BOUNTY, { item, sub })

  const storageKeyPrefix = item ? undefined : 'bounty'

  return (
    <Form
      initial={{
        title: item?.title || '',
        text: item?.text || '',
        crosspost: item ? !!item.noteId : me?.privates?.nostrCrossposting,
        bounty: item?.bounty || 1000,
        ...AdvPostInitial({ forward: normalizeForwards(item?.forwards), boost: item?.boost }),
        ...SubSelectInitial({ sub: item?.subName || sub?.name })
      }}
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
      <MarkdownInput
        topLevel
        label={
          <>
            {textLabel} <small className='text-muted ms-2'>optional</small>
          </>
        }
        name='text'
        minRows={6}
        hint={
          editThreshold
            ? (
              <div className='text-muted fw-bold font-monospace'>
                <Countdown date={editThreshold} />
              </div>
              )
            : null
        }
      />
      <AdvPostForm storageKeyPrefix={storageKeyPrefix} item={item} sub={sub} />
      <ItemButtonBar itemId={item?.id} canDelete={false} />
    </Form>
  )
}
