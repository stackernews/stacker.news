import { SNEditor } from '@/components/editor'
import { FormGroup } from './field'

export function SNInput ({ label, topLevel, groupClassName, onChange, ...props }) {
  return (
    <FormGroup label={label} className={groupClassName}>
      <SNEditor name={props.name} topLevel={topLevel} onChange={onChange} {...props} />
    </FormGroup>
  )
}
