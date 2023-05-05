import { Form, Input, MarkdownInput, SubmitButton } from '../components/form'
import { useRouter } from 'next/router'
import { gql, useApolloClient, useMutation } from '@apollo/client'
import TextareaAutosize from 'react-textarea-autosize'
import Countdown from './countdown'
import AdvPostForm, { AdvPostInitial } from './adv-post-form'
import FeeButton, { EditFeeButton } from './fee-button'
import { InputGroup } from 'react-bootstrap'
import { bountySchema } from '../lib/validate'

export function BountyForm ({
  item,
  sub,
  editThreshold,
  titleLabel = 'title',
  bountyLabel = 'bounty',
  textLabel = 'text',
  buttonText = 'post',
  adv,
  handleSubmit
}) {
  const router = useRouter()
  const client = useApolloClient()
  const schema = bountySchema(client)
  const [upsertBounty] = useMutation(
    gql`
      mutation upsertBounty(
        $sub: String
        $id: ID
        $title: String!
        $bounty: Int!
        $text: String
        $boost: Int
        $forward: String
      ) {
        upsertBounty(
          sub: $sub
          id: $id
          title: $title
          bounty: $bounty
          text: $text
          boost: $boost
          forward: $forward
        ) {
          id
        }
      }
    `
  )

  return (
    <Form
      initial={{
        title: item?.title || '',
        text: item?.text || '',
        bounty: item?.bounty || 1000,
        ...AdvPostInitial({ forward: item?.fwdUser?.name })
      }}
      schema={schema}
      onSubmit={
        handleSubmit ||
        (async ({ boost, bounty, ...values }) => {
          const { error } = await upsertBounty({
            variables: {
              sub: item?.subName || sub?.name,
              id: item?.id,
              boost: boost ? Number(boost) : undefined,
              bounty: bounty ? Number(bounty) : undefined,
              ...values
            }
          })
          if (error) {
            throw new Error({ message: error.toString() })
          }

          if (item) {
            await router.push(`/items/${item.id}`)
          } else {
            const prefix = sub?.name ? `/~${sub.name}/` : ''
            await router.push(prefix + '/recent')
          }
        })
      }
      storageKeyPrefix={item ? undefined : 'bounty'}
    >
      <Input label={titleLabel} name='title' required autoFocus clear />
      <Input
        label={bountyLabel} name='bounty' required
        append={<InputGroup.Text className='text-monospace'>sats</InputGroup.Text>}
      />
      <MarkdownInput
        topLevel
        label={
          <>
            {textLabel} <small className='text-muted ml-2'>optional</small>
          </>
        }
        name='text'
        as={TextareaAutosize}
        minRows={6}
        hint={
          editThreshold
            ? (
              <div className='text-muted font-weight-bold'>
                <Countdown date={editThreshold} />
              </div>
              )
            : null
        }
      />
      {adv && <AdvPostForm edit={!!item} />}
      <div className='mt-3'>
        {item
          ? (
            <EditFeeButton
              paidSats={item.meSats}
              parentId={null}
              text='save'
              ChildButton={SubmitButton}
              variant='secondary'
            />
            )
          : (
            <FeeButton
              baseFee={1}
              parentId={null}
              text={buttonText}
              ChildButton={SubmitButton}
              variant='secondary'
            />
            )}
      </div>
    </Form>
  )
}
