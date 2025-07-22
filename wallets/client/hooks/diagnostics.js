import { useMe } from '@/components/me'
import { useToast } from '@/components/toast'
import { SET_DIAGNOSTICS } from '@/fragments/users'
import { useMutation } from '@apollo/client'
import { useCallback, useState } from 'react'

export function useDiagnostics () {
  const { me } = useMe()
  const [diagnostics, _setDiagnostics] = useState(me?.privates?.diagnostics ?? false)
  const [mutate] = useMutation(SET_DIAGNOSTICS)
  const toaster = useToast()

  const setDiagnostics = useCallback(async (value) => {
    try {
      await mutate({ variables: { diagnostics: value } })
      _setDiagnostics(value)
    } catch (err) {
      console.error('failed to toggle diagnostics:', err)
      toaster.danger('failed to toggle diagnostics')
    }
  }, [mutate, toaster])

  return [diagnostics, setDiagnostics]
}
