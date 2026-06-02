import { Checkbox, Input } from '@/components/form'
import { useMe } from '@/components/me'
import { characterLength } from '@/lib/validate'
import { lnAddrFormFields } from '@/lib/lnurl'
import sharedStyles from '@/wallets/client/components/wallet.module.css'
import sendStyles from './send.module.css'
import AddIcon from '@/svgs/add-fill.svg'
import CloseIcon from '@/svgs/close-line.svg'
import classNames from 'classnames'
import { useFormikContext } from 'formik'
import { useCallback, useMemo, useState } from 'react'
import { InputGroup } from 'react-bootstrap'
const styles = { ...sharedStyles, ...sendStyles }

export function LightningAddressFields ({ service, maxFee }) {
  const { me } = useMe()
  const { values, setFieldValue } = useFormikContext()
  const [editingFields, setEditingFields] = useState(() => new Set())

  const { mandatory: mandatoryFields, optional: optionalFields } = useMemo(
    () => lnAddrFormFields(service),
    [service])

  const toggleField = useCallback((name) => {
    if (name === 'identifier') {
      setFieldValue('identifier', !values.identifier)
      return
    }

    if (values[name] || editingFields.has(name)) {
      setFieldValue(name, '')
      setEditingFields(fields => {
        const next = new Set(fields)
        next.delete(name)
        return next
      })
    } else {
      setEditingFields(fields => new Set(fields).add(name))
    }
  }, [editingFields, setFieldValue, values])

  const optionalFieldActive = field => field === 'identifier' ? Boolean(values.identifier) : Boolean(values[field] || editingFields.has(field))

  return (
    <>
      <Input
        label='amount'
        name='amount'
        type='number'
        step={10}
        min={service.min}
        max={service.max}
        required
        append={<InputGroup.Text className='text-monospace'>sats</InputGroup.Text>}
      />
      {mandatoryFields.map(field => <LightningAddressField key={field} name={field} service={service} values={values} me={me} required />)}
      {maxFee}
      {optionalFields.length > 0 && (
        <div className={classNames(styles.stackSection, styles.toggleChipSection)}>
          <div className={classNames(styles.toggleChipLabel, 'text-muted')}>optional</div>
          <div className='d-flex flex-wrap gap-2'>
            {optionalFields.map(field => (
              <FieldChip
                key={field}
                active={optionalFieldActive(field)}
                label={chipLabel(field, me)}
                onClick={() => toggleField(field)}
              />
            ))}
          </div>
          {optionalFields.filter(field => field !== 'identifier' && optionalFieldActive(field)).map(field => (
            <LightningAddressField key={field} name={field} service={service} values={values} me={me} />
          ))}
        </div>
      )}
    </>
  )
}

function FieldChip ({ active, label, onClick }) {
  const Icon = active ? CloseIcon : AddIcon
  return (
    <button
      type='button'
      className={classNames(styles.chip, styles.toggleChip, active && styles.chipActive)}
      onClick={onClick}
    >
      <Icon className={styles.toggleChipIcon} width={14} height={14} aria-hidden />
      <span>{label}</span>
    </button>
  )
}

function LightningAddressField ({ name, service, values, me, required }) {
  const label = required ? <>{fieldLabel(name, me)} <small className='text-muted ms-2'>(required)</small></> : fieldLabel(name, me)

  if (name === 'comment') {
    const remaining = service.commentAllowed - characterLength(values.comment)
    return (
      <Input
        as='textarea'
        label={label}
        name='comment'
        hint={`characters remaining: ${remaining}`}
      />
    )
  }

  if (name === 'identifier') {
    return (
      <Checkbox
        name='identifier'
        required={required}
        label={label}
      />
    )
  }

  return (
    <Input
      name={name}
      required={required}
      label={label}
    />
  )
}

function fieldLabel (field, me) {
  if (field === 'identifier') return `your ${me?.name ?? 'stacker'}@stacker.news identifier`
  return field
}

function chipLabel (field, me) {
  if (field === 'identifier') return `include ${me?.name ?? 'me'}@stacker.news`
  return field
}
