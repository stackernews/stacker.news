import { Form, Input, MarkdownInput, DateTimeInput } from '@/components/form'
import { useRouter } from 'next/router'
import { gql, useApolloClient, useMutation } from '@apollo/client'
import AdvPostForm, { AdvPostInitial } from './adv-post-form'
import useCrossposter from './use-crossposter'
import { eventSchema } from '@/lib/validate'
import { SubSelectInitial } from './sub-select'
import { useCallback } from 'react'
import { normalizeForwards, toastDeleteScheduled } from '@/lib/form'
import { MAX_TITLE_LENGTH } from '@/lib/constants'
import { useMe } from './me'
import { useToast } from './toast'
import { ItemButtonBar } from './post'
import Countdown from './countdown'

export function EventForm ({
  item,
  sub,
  editThreshold,
  titleLabel = 'Title',
  dateLabel = 'Date',
  locationLabel = 'Location',
  textLabel = 'Description',
  handleSubmit,
  children
}) {
  const router = useRouter()
  const client = useApolloClient()
  const me = useMe()
  const toaster = useToast()
  const crossposter = useCrossposter()
  const schema = eventSchema({ client, me })
  const [upsertEvent] = useMutation(
    gql`
      mutation upsertEvent(
        $sub: String
        $id: ID
        $title: String!
        $date: DateTime!
        $location: String!
        $text: String
        $forward: [ItemForwardInput]
        $hash: String
        $hmac: String
      ) {
        upsertEvent(
          sub: $sub
          id: $id
          title: $title
          date: $date
          location: $location
          text: $text
          forward: $forward
          hash: $hash
          hmac: $hmac
        ) {
          id
          deleteScheduledAt
        }
      }
    `
  )

  const onSubmit = useCallback(
    async ({ crosspost, ...values }) => {
      const { data, error } = await upsertEvent({
        variables: {
          sub: item?.subName || sub?.name,
          id: item?.id,
          ...values,
          forward: normalizeForwards(values.forward)
        }
      })
      if (error) {
        throw new Error({ message: error.toString() })
      }

      const eventId = data?.upsertEvent?.id

      if (crosspost && eventId) {
        await crossposter(eventId)
      }

      if (item) {
        await router.push(`/items/${item.id}`)
      } else {
        const prefix = sub?.name ? `/~${sub.name}` : ''
        await router.push(prefix + '/recent')
      }
      toastDeleteScheduled(toaster, data, 'upsertEvent', !!item, values.text)
    }, [upsertEvent, router]
  )

  return (
    <Form
      initial={{
        title: item?.title || '',
        date: item?.date || '',
        location: item?.location || '',
        text: item?.text || '',
        crosspost: item ? !!item.noteId : me?.privates?.nostrCrossposting,
        ...AdvPostInitial({ forward: normalizeForwards(item?.forwards) }),
        ...SubSelectInitial({ sub: item?.subName || sub?.name })
      }}
      schema={schema}
      invoiceable={{ requireSession: true }}
      onSubmit={
        handleSubmit ||
        onSubmit
      }
      storageKeyPrefix={item ? undefined : 'event'}
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
      <DateTimeInput
        label={dateLabel}
        name='date'
        className='pr-4'
        required
      />
      <Input
        label={locationLabel}
        name='location'
        required
      />
      <MarkdownInput
        topLevel
        label={textLabel}
        name='text'
        minRows={6}
        hint={
          editThreshold
            ? (
              <div className='text-muted fw-bold'>
                <Countdown date={editThreshold} />
              </div>
              )
            : null
        }
      />
      <AdvPostForm edit={!!item} item={item} />
      <ItemButtonBar itemId={item?.id} canDelete={false} />
    </Form>
  )
}
