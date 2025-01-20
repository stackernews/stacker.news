import Link from 'next/link'
import Info from '.'

export default function CCInfo (props) {
  return (
    <Info {...props}>
      <h6>Why am I getting cowboy credits?</h6>
      <ul className='line-height-md'>
        <li>to receive sats, you must attach an <Link href='/wallets'>external receiving wallet</Link></li>
        <li>zappers may have chosen to send you CCs instead of sats</li>
        <li>if the zaps are split on a post, recipients will receive CCs regardless of their configured receiving wallet</li>
        <li>there could be an issue paying your receiving wallet
          <ul>
            <li>if the zap is small and you don't have a direct channel to SN, the routing fee may exceed SN's 3% max fee</li>
            <li>check your <Link href='/wallets/logs'>wallet logs</Link> for clues</li>
            <li>if you have questions about the errors in your wallet logs, mention the error in the <Link href='/daily'>saloon</Link></li>
          </ul>
        </li>
        <li>some zaps might be smaller than your configured receiving dust limit
          <ul>
            <li>you can configure your dust limit in your <Link href='/settings'>settings</Link></li>
          </ul>
        </li>
      </ul>
    </Info>
  )
}
