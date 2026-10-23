import { useState } from 'react'
import Search from './search'

export { MobileSearchBar } from './mobile'
export { SearchStateProvider } from './state'
export { useRememberHistory } from './recent'

export default function SearchBar ({ className }) {
  const [open, setOpen] = useState(false)
  return <Search className={className} open={open} setOpen={setOpen} />
}
