import React from 'react'
import { Select } from '@/components/ui/select'
import { useUserSettings } from '@/components/me'

export default function UnitToggle () {
  const { unit, setUnit } = useUserSettings()
  return (
    <Select onValueChange={setUnit} defaultValue={unit}>
      <Select.Item value='bitcoin'>bitcoin</Select.Item>
      <Select.Item value='legacy'>BTC (legacy)</Select.Item>
    </Select>
  )
}