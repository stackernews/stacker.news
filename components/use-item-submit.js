import { useRouter } from 'next/router'
import { useToast } from './toast'
import usePayInMutation from '@/components/payIn/hooks/use-pay-in-mutation'
import useCrossposter from './use-crossposter'
import { useCallback } from 'react'
import { normalizeForwards, toastUpsertSuccessMessages } from '@/lib/form'
import { USER_ID } from '@/lib/constants'
import { useMe } from './me'

// this is intented to be compatible with upsert item mutations
// so that it can be reused for all post types and comments and we don't have
// to maintain several copies of the same code
// it's a bit much for an abstraction ... but it makes it easy to modify item-payment UX
// and other side effects like crossposting and redirection
// ... or I just spent too much time in this code and this is overcooked
// NOTE: sub is only used for the job form currently since it's the only form that can exist in a single territory
export default function useItemSubmit (mutation,
  { item, sub, onSuccessfulSubmit, navigateOnSubmit = true, extraValues = {}, payInMutationOptions = { } } = {}) {
  const router = useRouter()
  const toaster = useToast()
  const crossposter = useCrossposter()
  const [upsertItem] = usePayInMutation(mutation)
  const { me } = useMe()

  return useCallback(
    async ({ subNames: submittedSubNames, crosspost, title, options, bounty, status, ...values }, { resetForm }) => {
      if (options) {
        // remove existing poll options since else they will be appended as duplicates
        options = options.slice(item?.poll?.options?.length || 0).filter(o => o.trim().length > 0)
      }

      const hmacEdit = item?.id && Number(item.user.id) === USER_ID.anon && !me
      if (hmacEdit) {
        const invParams = window.localStorage.getItem(`item:${item.id}:hash:hmac`)
        if (invParams) {
          const [hash, hmac] = invParams.split(':')
          values.hash = hash
          values.hmac = hmac
        }
      }

      const subNames = submittedSubNames || item?.subNames || (sub?.name ? [sub.name] : [])
      const {
        cachePhases: payInCachePhases = {},
        onCompleted: payInOnCompleted,
        ...restPayInMutationOptions
      } = payInMutationOptions
      const mergedCachePhases = {
        ...payInCachePhases
        // NOTE: we intentionally do NOT fallback onPaidMissingResult to onMutationResult.
        // onMutationResult runs as Apollo's update() callback (optimistic layer context),
        // but onPaidMissingResult runs outside update() — reusing the same function would
        // put optimistic:true cache writes in the wrong layer. Callers that need
        // onPaidMissingResult should provide it explicitly with optimistic:false.
      }

      const { data, error, payError } = await upsertItem({
        variables: {
          id: item?.id,
          subNames,
          bounty: bounty ? Number(bounty) : undefined,
          status: status === 'STOPPED' ? 'STOPPED' : 'ACTIVE',
          title: title?.trim(),
          options,
          ...values,
          forward: normalizeForwards(values.forward),
          ...extraValues
        },
        // if not a comment, we want the qr to persist on navigation
        persistOnNavigate: navigateOnSubmit,
        ...restPayInMutationOptions,
        cachePhases: mergedCachePhases,
        onCompleted: (data) => {
          onSuccessfulSubmit?.(data, { resetForm })
          payInOnCompleted?.(data)
          saveItemInvoiceHmac(data)
        }
      })

      if (error) throw error
      if (payError) return

      // we don't know the mutation name, so we have to extract the result
      const response = Object.values(data)[0]
      const postId = response?.payerPrivates.result?.id

      if (crosspost && postId) {
        await crossposter(postId)
      }

      toastUpsertSuccessMessages(toaster, data, Object.keys(data)[0], values.text)

      // if we're not a comment, we want to redirect after the mutation
      if (navigateOnSubmit) {
        if (item) {
          await router.push(`/items/${item.id}`)
        } else {
          await router.push(subNames.length === 1 ? `/~${subNames[0]}/new` : '/new')
        }
      }
    }, [me, upsertItem, router, crossposter, item, onSuccessfulSubmit,
      navigateOnSubmit, extraValues, payInMutationOptions]
  )
}

function saveItemInvoiceHmac (mutationData) {
  console.log('saveItemInvoiceHmac', mutationData)
  const response = Object.values(mutationData)[0]

  if (!response?.payerPrivates?.payInBolt11) return

  const id = response.payerPrivates.result.id
  const { hash, hmac } = response.payerPrivates.payInBolt11

  if (id && hash && hmac) {
    window.localStorage.setItem(`item:${id}:hash:hmac`, `${hash}:${hmac}`)
  }
}
