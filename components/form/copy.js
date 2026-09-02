import { useCallback, useState } from 'react'
import copy from 'clipboard-copy'
import Thumb from '@/svgs/thumb-up-fill.svg'
import Clipboard from '@/svgs/clipboard-line.svg'
import { useToast } from '@/components/ui/toast'
import Button from '@/components/ui/button'
import { cn } from '@/lib/cn'
import { InputAddon } from './input-addon'
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
      <InputAddon aria-label='copy' onClick={handleClick}>
        <Clipboard height={20} width={20} />
      </InputAddon>
    )
  }

  if (append) {
    return (
      <button type='button' aria-label='copy' className={cn(styles.appendButton, 'bg-transparent border-0 p-0 cursor-pointer', className)} {...props} onClick={handleClick}>
        {append}
      </button>
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
        <CopyButton value={props.placeholder} size={props.size} className='rounded-s-none' />
      }
      {...props}
    />
  )
}
