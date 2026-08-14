import { useCallback, useState } from 'react'
import copy from 'clipboard-copy'
import Thumb from '@/svgs/thumb-up-fill.svg'
import Clipboard from '@/svgs/clipboard-line.svg'
import { useToast } from '@/components/ui/toast'
import Button from '@/components/ui/button'
import { cn } from '@/lib/cn'
import InputGroup from './input-group'
import { Input } from './input'
import styles from './field.module.css'

export function CopyButton ({ value, icon, append, className, ...props }) {
  const toaster = useToast()
  const [copied, setCopied] = useState(false)

  const handleClick = useCallback(async () => {
    try {
      await copy(value)
      toaster.success('copied')
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch (err) {
      toaster.danger('failed to copy')
    }
  }, [toaster, value])

  if (icon) {
    return (
      <InputGroup.Text style={{ cursor: 'pointer' }} onClick={handleClick}>
        <Clipboard height={20} width={20} />
      </InputGroup.Text>
    )
  }

  if (append) {
    return (
      <span className={cn(styles.appendButton, className)} {...props} onClick={handleClick}>
        {append}
      </span>
    )
  }

  return (
    <Button className={cn(styles.appendButton, className)} {...props} onClick={handleClick}>
      {copied ? <Thumb width={18} height={18} /> : 'copy'}
    </Button>
  )
}

export function CopyInput (props) {
  return (
    <Input
      append={
        // The call site owns the shared corner through the utility layer.
        <CopyButton value={props.placeholder} size={props.size} className='rounded-s-none' />
      }
      {...props}
    />
  )
}
