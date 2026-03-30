import Link from 'next/link'
import Info from '.'

export default function RewardSatsInfo (props) {
  return (
    <Info {...props}>
      <h6>Where did my sats come from?</h6>
      <ul>
        <li>you may have sats from before <Link href='/items/835465'>SN went not-custodial</Link></li>
        <li>sats also come from <Link href='/rewards'>daily rewards</Link> and territory revenue
          <ul>
            <li>you can configure these sats to autowithdraw by attaching an <Link href='/wallets'>external receiving wallet</Link></li>
          </ul>
        </li>
      </ul>
    </Info>
  )
}
