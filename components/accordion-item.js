import { useEffect, useState } from 'react'
import { Collapsible, CollapsibleTrigger, CollapsiblePanel } from './ui/collapsible'
import styles from './ui/collapsible.module.css'
import ArrowRight from '@/svgs/arrow-right-s-fill.svg'
import ArrowDown from '@/svgs/arrow-down-s-fill.svg'
import { cn } from '@/lib/cn'

export default function AccordionItem ({ header, body, className, headerColor = 'var(--sn-grey)', show }) {
  const [open, setOpen] = useState(!!show)

  useEffect(() => {
    // if we want to show the accordion and it's not open, open it
    setOpen(!!show)
  }, [show])

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className='flex items-center w-full'>
        {open
          ? <ArrowDown style={{ fill: headerColor }} height={20} width={20} />
          : <ArrowRight style={{ fill: headerColor }} height={20} width={20} />}
        <div style={{ color: headerColor }}>{header}</div>
      </CollapsibleTrigger>
      <CollapsiblePanel className={cn('mt-2', className)}>{body}</CollapsiblePanel>
    </Collapsible>
  )
}

export function AccordionCard ({ header, children, show, className }) {
  return (
    <Collapsible defaultOpen={!!show} className={cn(styles.card, className)}>
      <CollapsibleTrigger className={cn(styles.cardTrigger, 'flex items-center w-full')}>
        {header}
        <ArrowDown className={cn(styles.cardChevron, 'ms-auto shrink-0')} height={20} width={20} />
      </CollapsibleTrigger>
      <CollapsiblePanel>
        <div className={styles.cardBody}>{children}</div>
      </CollapsiblePanel>
    </Collapsible>
  )
}
