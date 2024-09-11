import { useRouter } from 'next/router'
import { useToast } from './toast'
import { usePaidMutation, paidActionCacheMods } from './use-paid-mutation'
import useCrossposter from './use-crossposter'
import { useCallback } from 'react'
import { normalizeForwards, toastUpsertSuccessMessages } from '@/lib/form'
import { RETRY_PAID_ACTION } from '@/fragments/paidAction'
import gql from 'graphql-tag'

// this is intented to be compatible with upsert item mutations
// so that it can be reused for all post types and comments and we don't have
// to maintain several copies of the same code
// it's a bit much for an abstraction ... but it makes it easy to modify item-payment UX
// and other side effects like crossposting and redirection
// ... or I just spent too much time in this code and this is overcooked
export default function useItemSubmit (mutation,
  { item, sub, onSuccessfulSubmit, navigateOnSubmit = true, extraValues = {}, paidMutationOptions = { } } = {}) {
  const router = useRouter()
  const toaster = useToast()
  const crossposter = useCrossposter()
  const [upsertItem] = usePaidMutation(mutation)

  return useCallback(
    async ({ boost, crosspost, title, options, bounty, maxBid, start, stop, ...values }, { resetForm }) => {
      if (options) {
        // remove existing poll options since else they will be appended as duplicates
        options = options.slice(item?.poll?.options?.length || 0).filter(o => o.trim().length > 0)
      }

      if (item?.id) {
        const invoiceData = window.localStorage.getItem(`item:${item.id}:hash:hmac`)
        if (invoiceData) {
          const [hash, hmac] = invoiceData.split(':')
          values.hash = hash
          values.hmac = hmac
        }
      }

      const { data, error, payError } = await upsertItem({
        variables: {
          id: item?.id,
          sub: item?.subName || sub?.name,
          boost: boost ? Number(boost) : undefined,
          bounty: bounty ? Number(bounty) : undefined,
          maxBid: (maxBid || Number(maxBid) === 0) ? Number(maxBid) : undefined,
          status: start ? 'ACTIVE' : stop ? 'STOPPED' : undefined,
          title: title?.trim(),
          options,
          ...values,
          forward: normalizeForwards(values.forward),
          ...extraValues
        },
        // if not a comment, we want the qr to persist on navigation
        persistOnNavigate: navigateOnSubmit,
        ...paidMutationOptions,
        onPayError: (e, cache, { data }) => {
          paidActionCacheMods.onPayError(e, cache, { data })
          paidMutationOptions?.onPayError?.(e, cache, { data })
        },
        onPaid: (cache, { data }) => {
          paidActionCacheMods.onPaid(cache, { data })
          paidMutationOptions?.onPaid?.(cache, { data })
        },
        onCompleted: (data) => {
          onSuccessfulSubmit?.(data, { resetForm })
          paidMutationOptions?.onCompleted?.(data)
          saveItemInvoiceHmac(data)
        }
      })

      if (error) throw error
      if (payError) return

      // we don't know the mutation name, so we have to extract the result
      const response = Object.values(data)[0]
      const postId = response?.result?.id

      if (crosspost && postId) {
        await crossposter(postId)
      }

      toastUpsertSuccessMessages(toaster, data, Object.keys(data)[0], values.text)

      // if we're not a comment, we want to redirect after the mutation
      if (navigateOnSubmit) {
        if (item) {
          await router.push(`/items/${item.id}`)
        } else {
          await router.push(sub ? `/~${sub.name}/recent` : '/recent')
        }
      }
    }, [upsertItem, router, crossposter, item, sub, onSuccessfulSubmit,
      navigateOnSubmit, extraValues, paidMutationOptions]
  )
}

export function useRetryCreateItem ({ id }) {
  const [retryPaidAction] = usePaidMutation(
    RETRY_PAID_ACTION,
    {
      ...paidActionCacheMods,
      update: (cache, { data }) => {
        const response = Object.values(data)[0]
        if (!response?.invoice) return
        cache.modify({
          id: `Item:${id}`,
          fields: {
            // this is a bit of a hack just to update the reference to the new invoice
            invoice: () => cache.writeFragment({
              id: `Invoice:${response.invoice.id}`,
              fragment: gql`
                fragment _ on Invoice {
                  bolt11
                }
              `,
              data: { bolt11: response.invoice.bolt11 }
            })
          }
        })
        paidActionCacheMods?.update?.(cache, { data })
      }
    }
  )

  return retryPaidAction
}

function saveItemInvoiceHmac (mutationData) {
  const response = Object.values(mutationData)[0]

  if (!response?.invoice) return

  const id = response.result.id
  const { hash, hmac } = response.invoice

  if (id && hash && hmac) {
    window.localStorage.setItem(`item:${id}:hash:hmac`, `${hash}:${hmac}`)
  }
}
