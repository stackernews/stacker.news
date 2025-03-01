import { useEffect, useState } from 'react'
import { datePivot } from '@/lib/time'
import { useMe } from '@/components/me'
import { ITEM_EDIT_SECONDS, USER_ID } from '@/lib/constants'

export default function useCanShadowEdit (item) {
  const editThreshold = datePivot(new Date(item.invoice?.confirmedAt ?? item.createdAt), { seconds: ITEM_EDIT_SECONDS })
  const { me } = useMe()

  // deleted items can never be edited and every item has a 10 minute shadow edit window
  // except bios, they can always be edited but they should never show the countdown
  const noEdit = !!item.deletedAt || item.bio
  const authorEdit = me && item.mine
  const [canShadowEdit, setCanShadowEdit] = useState(!noEdit && authorEdit)

  useEffect(() => {
    // allow anon shadow edits if they have the correct hmac for the item invoice
    // (the server will verify the hmac)
    const invParams = window.localStorage.getItem(`item:${item.id}:hash:hmac`)
    const anonEdit = !!invParams && !me && Number(item.user.id) === USER_ID.anon
    // anonEdit should not override canShadowEdit, but only allow edits if they aren't already allowed
    setCanShadowEdit(canShadowEdit => canShadowEdit || anonEdit)
  }, [])

  return [canShadowEdit, setCanShadowEdit, editThreshold]
}
