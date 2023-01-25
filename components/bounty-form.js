import { Form, Input, MarkdownInput, SubmitButton } from '../components/form'
import { useRouter } from 'next/router'
import * as Yup from 'yup'
import { gql, useApolloClient, useMutation } from '@apollo/client'
import TextareaAutosize from 'react-textarea-autosize'
import Countdown from './countdown'
import AdvPostForm, { AdvPostInitial, AdvPostSchema } from './adv-post-form'
import { MAX_TITLE_LENGTH } from '../lib/constants'
import FeeButton, { EditFeeButton } from './fee-button'
import { InputGroup } from 'react-bootstrap'

export function BountyForm ({
  item,
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
  const [upsertBounty] = useMutation(
    gql`
      mutation upsertBounty(
        $id: ID
        $title: String!
        $bounty: Int!
        $text: String
        $boost: Int
        $forward: String
      ) {
        upsertBounty(
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

  const BountySchema = Yup.object({
    title: Yup.string()
      .required('required')
      .trim()
      .max(
        MAX_TITLE_LENGTH,
        ({ max, value }) => `${Math.abs(max - value.length)} too many`
      ),
    bounty: Yup.number()
      .required('required')
      .min(1000, 'must be at least 1000 sats')
      .max(1000000, 'must be at most 1m sats')
      .integer('must be whole'),

    ...AdvPostSchema(client)
  })

  return (
    <Form
      initial={{
        title: item?.title || '',
        text: item?.text || '',
        bounty: item?.bounty || 1000,
        suggest: '',
        ...AdvPostInitial({ forward: item?.fwdUser?.name })
      }}
      schema={BountySchema}
      onSubmit={
        handleSubmit ||
        (async ({ boost, bounty, ...values }) => {
          const { error } = await upsertBounty({
            variables: {
              id: item?.id,
              boost: Number(boost),
              bounty: Number(bounty),
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
        })
      }
      storageKeyPrefix={item ? undefined : 'discussion'}
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
