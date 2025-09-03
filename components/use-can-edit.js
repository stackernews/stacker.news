import { useEffect, useState } from 'react'
import { datePivot } from '@/lib/time'
import { useMe } from '@/components/me'
import { ITEM_EDIT_SECONDS, USER_ID } from '@/lib/constants'

export default function useCanEdit (item) {
  const editThreshold = datePivot(new Date(item.invoice?.confirmedAt ?? item.createdAt), { seconds: ITEM_EDIT_SECONDS })
  const { me } = useMe()

  // deleted items can never be edited and every item has a 10 minute edit window
  // except bios, they can always be edited but they should never show the countdown
  const noEdit = !!item.deletedAt || (Date.now() >= editThreshold) || item.bio
  const authorEdit = me && item.mine
  const [canEdit, setCanEdit] = useState(!noEdit && authorEdit)
  const invParams = typeof window !== 'undefined' && window.localStorage.getItem(`item:${item.id}:hash:hmac`)

  useEffect(() => {
    // allow anon edits if they have the correct hmac for the item invoice
    // (the server will verify the hmac)
    console.log('invParams', invParams)
    const anonEdit = !!invParams && !me && Number(item.user.id) === USER_ID.anon
    // anonEdit should not override canEdit, but only allow edits if they aren't already allowed
    setCanEdit(canEdit => canEdit || anonEdit)
  }, [invParams])

  return [canEdit, setCanEdit, editThreshold]
}
