import { useEffect, useState } from 'react'
import { datePivot } from '@/lib/time'
import { useMe } from '@/components/me'
import { ITEM_EDIT_SECONDS, USER_ID } from '@/lib/constants'

export default function useCanEdit (item) {
  const editThreshold = datePivot(new Date(item.paidAt ?? item.createdAt), { seconds: ITEM_EDIT_SECONDS })
  const { me } = useMe()

  // deleted items can never be edited and every item has a 10 minute edit window
  // except bios and jobs, which can always be edited
  const noEdit = !!item.deletedAt || (!item.bio && !item.isJob && Date.now() >= editThreshold)
  const authorEdit = me && item.mine
  const [canEdit, setCanEdit] = useState(authorEdit && !item.deletedAt && (!item.paidAt || !noEdit))

  useEffect(() => {
    // allow anon edits if they have the correct hmac for the item invoice
    // (the server will verify the hmac)
    const invParams = window.localStorage.getItem(`item:${item.id}:hash:hmac`)
    const anonEdit = !!invParams && !me && Number(item.user.id) === USER_ID.anon
    // anonEdit should not override canEdit, but only allow edits if they aren't already allowed
    setCanEdit(canEdit => canEdit || anonEdit)
    // update when the hmac gets set
  }, [item?.invoice?.hmac])

  return [canEdit, setCanEdit, editThreshold]
}
