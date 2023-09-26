import { Form, Input, MarkdownInput, SubmitButton } from '../components/form'
import { useRouter } from 'next/router'
import { gql, useApolloClient, useLazyQuery, useMutation } from '@apollo/client'
import Countdown from './countdown'
import AdvPostForm, { AdvPostInitial } from './adv-post-form'
import FeeButton, { EditFeeButton } from './fee-button'
import { ITEM_FIELDS } from '../fragments/items'
import AccordianItem from './accordian-item'
import Item from './item'
import Delete from './delete'
import Button from 'react-bootstrap/Button'
import { discussionSchema } from '../lib/validate'
import { SubSelectInitial } from './sub-select-form'
import CancelButton from './cancel-button'
import { useCallback } from 'react'
import { crosspostDiscussion } from '../lib/nostr'
import { normalizeForwards } from '../lib/form'
import { MAX_TITLE_LENGTH } from '../lib/constants'
import {DEFAULT_CROSSPOSTING_RELAYS} from '../lib/nostr'
import { useMe } from './me'
import { useToast } from './toast'

export function DiscussionForm({
  item, sub, editThreshold, titleLabel = 'title',
  textLabel = 'text', buttonText = 'post',
  handleSubmit, children
}) {
  const router = useRouter()
  const client = useApolloClient()
  const me = useMe()
  const schema = discussionSchema({ client, me, existingBoost: item?.boost })
  // if Web Share Target API was used
  const shareTitle = router.query.title
  const Toast = useToast()
  const relays = [...DEFAULT_CROSSPOSTING_RELAYS, ...me?.nostrRelays || []];

  const [upsertDiscussion] = useMutation(
    gql`
      mutation upsertDiscussion($sub: String, $id: ID, $title: String!, $text: String, $boost: Int, $forward: [ItemForwardInput], $hash: String, $hmac: String) {
        upsertDiscussion(sub: $sub, id: $id, title: $title, text: $text, boost: $boost, forward: $forward, hash: $hash, hmac: $hmac) {
          id
        }
      }`
  )

  const relayError = (failedRelays) => {
    return new Promise((resolve) => {
      const { removeToast } = Toast.danger(
        <>
          Crossposting failed for {failedRelays.join(", ")} <br />
          <Button variant="link" onClick={() => {
            resolve('retry');
            setTimeout(() => {
              removeToast();
            }, 1000);
          }}>Retry</Button>
          {" | "}
          <Button variant="link" onClick={() => {
            resolve('skip');
          }}>Skip</Button>
        </>,
        () => resolve('skip') // will skip if user closes the toast
      );
    });
  };
  
  const handleCrosspost = async (values, id) => {
    let failedRelays;
    let allSuccessful = false;

    do {
      let result = await crosspostDiscussion(values, id, failedRelays || relays);

      result.successfulRelays.forEach(relay => {
        Toast.success(`Crossposting succeeded on relay ${relay}`);
      });

      failedRelays = result.failedRelays.map(relayObj => relayObj.relay);

      if (failedRelays.length > 0) {
        const userAction = await relayError(failedRelays);

        if (userAction === 'skip') {
          Toast.success("Crossposting skipped.");
          break;
        }
      } else {
        allSuccessful = true;
      }

    } while (failedRelays.length > 0);

    return { allSuccessful };
  };

  const onSubmit = useCallback(
    async ({ boost, crosspost, ...values }) => {
      const { data, error } = await upsertDiscussion({
        variables: {
          sub: item?.subName || sub?.name,
          id: item?.id,
          boost: boost ? Number(boost) : undefined,
          ...values,
          forward: normalizeForwards(values.forward)
        }
      })

      if (error) {
        throw new Error({ message: error.toString() })
      }

      const shouldCrosspost = me?.nostrCrossposting && crosspost

      if (shouldCrosspost && data?.upsertDiscussion?.id) {
        const results = await handleCrosspost(values, data.upsertDiscussion.id);
        if (results.allSuccessful) {
          if (item) {
            await router.push(`/items/${item.id}`)
          } else {
            const prefix = sub?.name ? `/~${sub.name}` : ''
            await router.push(prefix + '/recent')
          }
        }
      }

      if (item) {
        await router.push(`/items/${item.id}`)
      } else {
        const prefix = sub?.name ? `/~${sub.name}` : ''
        await router.push(prefix + '/recent')
      }
    }, [upsertDiscussion, router]
  )

  const [getRelated, { data: relatedData }] = useLazyQuery(gql`
    ${ITEM_FIELDS}
    query related($title: String!) {
      related(title: $title, minMatch: "75%", limit: 3) {
        items {
          ...ItemFields
        }
      }
    }`)

  const related = relatedData?.related?.items || []

  // const cost = linkOrImg ? 10 : me?.freePosts ? 0 : 1

  return (
    <Form
      initial={{
        title: item?.title || shareTitle || '',
        text: item?.text || '',
        crosspost: me?.nostrCrossposting,
        ...AdvPostInitial({ forward: normalizeForwards(item?.forwards), boost: item?.boost }),
        ...SubSelectInitial({ sub: item?.subName || sub?.name })
      }}
      schema={schema}
      invoiceable
      onSubmit={handleSubmit || onSubmit}
      storageKeyPrefix={item ? undefined : 'discussion'}
    >
      {children}
      <Input
        label={titleLabel}
        name='title'
        required
        autoFocus
        clear
        onChange={async (formik, e) => {
          if (e.target.value) {
            getRelated({
              variables: { title: e.target.value }
            })
          }
        }}
        maxLength={MAX_TITLE_LENGTH}
      />
      <MarkdownInput
        topLevel
        label={<>{textLabel} <small className='text-muted ms-2'>optional</small></>}
        name='text'
        minRows={6}
        hint={editThreshold
          ? <div className='text-muted fw-bold'><Countdown date={editThreshold} /></div>
          : null}
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
              baseFee={1} parentId={null} text={buttonText}
              ChildButton={SubmitButton} variant='secondary'
            />}
      </div>
      {!item &&
        <div className={`mt-3 ${related.length > 0 ? '' : 'invisible'}`}>
          <AccordianItem
            header={<div style={{ fontWeight: 'bold', fontSize: '92%' }}>similar</div>}
            body={
              <div>
                {related.map((item, i) => (
                  <Item item={item} key={item.id} />
                ))}
              </div>
              }
          />
        </div>}
    </Form>
  )
}
