import { useCallback } from 'react'
import { useMutation } from '@apollo/client'
import { useMe } from '@/components/me'
import { useToast } from '@/components/toast'
import { SET_DIAGNOSTICS } from '@/fragments/users'

export function useDiagnostics () {
  const { me, refreshMe } = useMe()
  const [mutate] = useMutation(SET_DIAGNOSTICS)
  const toaster = useToast()

  const setDiagnostics = useCallback(async (diagnostics) => {
    try {
      await mutate({ variables: { diagnostics } })
      await refreshMe()
    } catch (err) {
      console.error('failed to toggle diagnostics:', err)
      toaster.danger('failed to toggle diagnostics')
    }
  }, [mutate, toaster, refreshMe])

  return [me?.privates?.diagnostics ?? false, setDiagnostics]
}
