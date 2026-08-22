import { SNEditor } from '@/components/editor'
import { FormGroup } from './field'
import { useId } from 'react'

export function SNInput ({ label, topLevel, groupClassName, onChange, ...props }) {
  const labelId = useId()
  return (
    <FormGroup label={label} labelId={labelId} className={groupClassName}>
      <SNEditor name={props.name} topLevel={topLevel} onChange={onChange} aria-labelledby={label ? labelId : undefined} {...props} />
    </FormGroup>
  )
}
