import Info from '@/components/info'

export function SparkCustodyNotice ({ wallet }) {
  if (wallet?.name !== 'SPARK') return null

  return (
    <Info size={14} label='treat like a custodial wallet' iconClassName='text-muted' iconPosition='end'>
      <SparkCustodyInfo />
    </Info>
  )
}

function SparkCustodyInfo () {
  return (
    <>
      <h4>treat like a custodial wallet</h4>
      <ol className='mb-0'>
        <li>do not store more money in this wallet than you can afford to lose.</li>
        <li>if privacy is important to you, be aware that this wallet relies on third-party infrastructure that can observe your IP address and wallet activity.</li>
        <li>this wallet lacks unilateral exit. without the permission of Spark, you can lose access to your funds.</li>
      </ol>
    </>
  )
}
