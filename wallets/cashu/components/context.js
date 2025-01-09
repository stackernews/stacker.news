import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import useIndexedDB, { getDbName } from '@/components/use-indexeddb'
import { useMe } from '@/components/me'

function useCashuDb () {
  const { me } = useMe()
  const idbConfig = useMemo(() => ({ dbName: getDbName(me?.id, 'cashu'), storeName: 'cashu', options: {} }), [me?.id])
  return useIndexedDB(idbConfig)
}

const CashuContext = createContext({})

export function CashuProvider ({ children }) {
  const { get, set } = useCashuDb()
  const proofs = useRef([])
  const [balance, setBalance] = useState(0)

  useEffect(() => {
    (async () => {
      const initialProofs = await get('proofs') ?? []
      proofs.current = initialProofs
      setBalance(initialProofs.reduce((acc, proof) => acc + proof.amount, 0))
    })()
  }, [])

  const setProofs = useCallback(async (newProofs) => {
    proofs.current = newProofs
    await set('proofs', newProofs)
    setBalance(newProofs.reduce((acc, proof) => acc + proof.amount, 0))
  }, [set])

  const addProofs = useCallback(async (newProofs) => {
    await setProofs([...proofs.current, ...newProofs])
  }, [setProofs])

  const value = useMemo(() => ({ balance, proofs, setProofs, addProofs }), [balance, setProofs, addProofs])
  return (
    <CashuContext.Provider value={value}>
      {children}
    </CashuContext.Provider>
  )
}

export function useCashuBalance () {
  const { balance } = useContext(CashuContext)
  return balance
}

export function useCashuProofs () {
  const { proofs, addProofs, setProofs } = useContext(CashuContext)
  return { proofs, addProofs, setProofs }
}
