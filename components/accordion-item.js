import { useEffect, useState } from 'react'
import Collapsible from './ui/collapsible'
import styles from './ui/collapsible.module.css'
import ArrowRight from '@/svgs/arrow-right-s-fill.svg'
import ArrowDown from '@/svgs/arrow-down-s-fill.svg'
import { cn } from '@/lib/cn'

export default function AccordionItem ({ header, body, className, headerColor = 'var(--theme-grey)', show }) {
  const [open, setOpen] = useState(!!show)

  useEffect(() => {
    // `show` transitions force open/close; manual toggles stay free either way
    setOpen(!!show)
  }, [show])

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Collapsible.Trigger className='flex items-center w-full'>
        {open
          ? <ArrowDown style={{ fill: headerColor }} height={20} width={20} />
          : <ArrowRight style={{ fill: headerColor }} height={20} width={20} />}
        <div style={{ color: headerColor }}>{header}</div>
      </Collapsible.Trigger>
      <Collapsible.Panel className={cn('mt-2', className)}>{body}</Collapsible.Panel>
    </Collapsible>
  )
}

export function AccordionCard ({ header, children, show, className }) {
  return (
    <Collapsible defaultOpen={!!show} className={cn(styles.card, className)}>
      <Collapsible.Trigger className={cn(styles.cardTrigger, 'flex items-center w-full')}>
        {header}
        <ArrowDown className={cn(styles.cardChevron, 'ms-auto shrink-0')} height={20} width={20} />
      </Collapsible.Trigger>
      <Collapsible.Panel>
        <div className={styles.cardBody}>{children}</div>
      </Collapsible.Panel>
    </Collapsible>
  )
}
