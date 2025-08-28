import { useEffect, useState } from 'react'
import { datePivot } from '@/lib/time'
import { useMe } from '@/components/me'
import { ITEM_EDIT_SECONDS, USER_ID } from '@/lib/constants'

export default function useCanEdit (item) {
  const editThreshold = datePivot(new Date(item.payIn?.payInStateChangedAt ?? item.createdAt), { seconds: ITEM_EDIT_SECONDS })
  const { me } = useMe()

  // deleted items can never be edited and every item has a 10 minute edit window
  // except bios, they can always be edited but they should never show the countdown
  const noEdit = !!item.deletedAt || (Date.now() >= editThreshold) || item.bio
  const authorEdit = me && item.mine
  const [canEdit, setCanEdit] = useState(!noEdit && authorEdit)

  useEffect(() => {
    // allow anon edits if they have the correct hmac for the item invoice
    // (the server will verify the hmac)
    const invParams = window.localStorage.getItem(`item:${item.id}:hash:hmac`)
    const anonEdit = !!invParams && !me && Number(item.user.id) === USER_ID.anon
    // anonEdit should not override canEdit, but only allow edits if they aren't already allowed
    setCanEdit(canEdit => canEdit || anonEdit)
  }, [])

  return [canEdit, setCanEdit, editThreshold]
}
