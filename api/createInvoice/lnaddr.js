import { lnAddrOptions } from '@/lib/lnurl'

export default async ({ addr }, { msats, description }) => {
  const { callback, commentAllowed } = await lnAddrOptions(addr)
  const callbackUrl = new URL(callback)
  callbackUrl.searchParams.append('amount', msats)

  if (commentAllowed >= description?.length) {
    callbackUrl.searchParams.append('comment', description)
  }

  // call callback with amount and conditionally comment
  const res = await (await fetch(callbackUrl.toString())).json()
  if (res.status === 'ERROR') {
    throw new Error(res.reason)
  }

  return res.pr
}
