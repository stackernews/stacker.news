import { ITEM_TYPES, ITEM_TYPES_UNIVERSAL } from '@/lib/constants'
import { Checkbox, Select } from './form'
import { useRouter } from 'next/router'
import { usePrefix } from './territory-domains'

function ActiveBountiesCheckbox ({ prefix }) {
  const router = useRouter()

  const onChange = (checked) => {
    if (checked) {
      router.push(prefix + '/new/bounties?' + new URLSearchParams({ active: true }).toString())
    } else {
      router.push(prefix + '/new/bounties')
    }
  }

  return (
    <Checkbox
      noForm inline
      label='active only'
      groupClassName='mx-2 mb-2'
      checked={router.query.active === 'true'}
      handleChange={onChange}
    />
  )
}

export default function NewHeader ({ type, sub }) {
  const router = useRouter()
  const prefix = usePrefix(sub?.name)

  const items = sub
    ? ITEM_TYPES_UNIVERSAL.concat(sub.postTypes.map(p =>
      ['LINK', 'DISCUSSION', 'POLL', 'JOB'].includes(p) ? `${p.toLowerCase()}s` : 'bounties'
    ))
    : ITEM_TYPES

  type ||= router.query.type || type || 'posts'

  return (
    <div className='flex-wrap'>
      <div className='text-muted font-bold my-1 flex justify-start items-center'>
        <Select
          groupClassName='mb-2'
          className='w-auto'
          name='type'
          value={type}
          items={items}
          noForm
          onChange={(_, e) => router.push(prefix + (e.target.value === 'posts' ? '/new' : `/new/${e.target.value}`))}
        />
        {type === 'bounties' && <ActiveBountiesCheckbox prefix={prefix} />}
      </div>
    </div>
  )
}
