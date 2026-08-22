import { ITEM_TYPES, ITEM_TYPES_UNIVERSAL } from '@/lib/constants'
import { Checkbox as BaseCheckbox } from '@base-ui/react/checkbox'
import { cn } from '@/lib/cn'
import checkboxStyles from '@/components/form/checkbox.module.css'
import { Select } from './form'
import { useRouter } from 'next/router'
import { usePrefix } from './territory-domains'

function ActiveBountiesCheckbox ({ prefix }) {
  const router = useRouter()

  const onChange = (e) => {
    if (e.target.checked) {
      router.push(prefix + '/new/bounties?' + new URLSearchParams({ active: true }).toString())
    } else {
      router.push(prefix + '/new/bounties')
    }
  }

  return (
    <div className='mx-2 mb-2'>
      <label className={cn(checkboxStyles.check, 'inline-flex me-4 items-center')}>
        <BaseCheckbox.Root
          checked={router.query.active === 'true'}
          onCheckedChange={checked => onChange({ target: { checked } })}
          className={cn(checkboxStyles.checkInput, checkboxStyles.checkbox)}
        />
        <span>active only</span>
      </label>
    </div>
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
          size='sm'
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
