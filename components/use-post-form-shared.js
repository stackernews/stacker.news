import { useMe } from './me'
import { AdvPostInitial } from './adv-post-form'
import { SubSelectInitial } from './sub-select'
import { normalizeForwards } from '@/lib/form'
import useItemSubmit from './use-item-submit'
import { useApolloClient } from '@apollo/client'
import { useRouter } from 'next/router'

/**
 * Shared hook for post form initialization
 * Reduces duplication across BountyForm, DiscussionForm, LinkForm, PollForm
 *
 * @param {Object} options
 * @param {Object} options.item - Existing item being edited (optional)
 * @param {Array} options.subs - Array of sub objects
 * @param {Object} options.mutation - GraphQL mutation for upserting
 * @param {Function} options.schema - Schema function for validation
 * @param {string} options.prefix - Storage key prefix for drafts (e.g., 'bounty', 'discussion')
 * @param {Object} options.extra - Extra initial values specific to the form type
 * @returns {Object} { initial, onSubmit, me, storageKeyPrefix }
 */
export function usePostFormShared ({ item, subs, mutation, schemaFn, storageKeyPrefix: prefix, extraInitialValues = {} }) {
  const router = useRouter()
  // if Web Share Target API was used
  const shareTitle = router.query.title
  const shareText = router.query.text ? decodeURI(router.query.text) : undefined
  const { me } = useMe()
  const client = useApolloClient()
  const onSubmit = useItemSubmit(mutation, { item })
  const schema = schemaFn?.({ client, me })
  const storageKeyPrefix = item ? undefined : prefix

  const initial = {
    title: item?.title || shareTitle || '',
    text: item?.text || shareText || '',
    crosspost: item ? !!item.noteId : me?.privates?.nostrCrossposting,
    ...AdvPostInitial({ forward: normalizeForwards(item?.forwards) }),
    ...SubSelectInitial({ item, subs }),
    ...extraInitialValues
  }

  return { initial, onSubmit, me, client, storageKeyPrefix, schema }
}
