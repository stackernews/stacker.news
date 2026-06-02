import copy from 'clipboard-copy'
import { useToast } from '@/components/toast'
import styles from './copy-chip.module.css'

function chipClassName ({ full, tone, truncate, className }) {
  return [
    styles.chip,
    full ? styles.chipFull : null,
    tone === 'danger' ? styles.danger : null,
    truncate ? styles.truncateChip : null,
    className
  ].filter(Boolean).join(' ')
}

export default function CopyChip ({ value, prefix, tailLength = 6, children, title = value, ...props }) {
  const toaster = useToast()
  const onClick = async () => {
    try {
      await copy(value)
      toaster.success('copied')
    } catch (err) {
      console.error('failed to copy chip value:', err)
      toaster.danger('failed to copy')
    }
  }
  return (
    <Chip {...props} title={title} truncate={!children} onClick={onClick}>
      {children ?? <MiddleEllipsis prefix={prefix} value={value} tailLength={tailLength} />}
    </Chip>
  )
}

export function Chip ({ children, full, tone, truncate, className, title, onClick }) {
  if (onClick) {
    return (
      <button type='button' className={chipClassName({ full, tone, truncate, className })} title={title} onClick={onClick}>
        {children}
      </button>
    )
  }

  return (
    <span className={chipClassName({ full, tone, truncate, className })} title={title}>
      {children}
    </span>
  )
}

export function MiddleEllipsis ({ prefix, value, tailLength = 6 }) {
  const tail = preserveEdgeSpaces(value.slice(-tailLength))
  const head = preserveEdgeSpaces(value.slice(0, -tailLength))
  return (
    <>
      {prefix && <span className={styles.prefix}>{prefix}&nbsp;</span>}
      <span className={styles.middleEllipsis}>
        <span className={styles.head}>{head}</span>
        <span className={styles.tail}>{tail}</span>
      </span>
    </>
  )
}

function preserveEdgeSpaces (value) {
  return value.replace(/(^ +| +$)/g, spaces => '\u00a0'.repeat(spaces.length))
}
