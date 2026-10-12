import { useState } from 'react'
import Search from './search'

export { SearchStateProvider } from './state'

export default function SearchBar ({ className }) {
  const [open, setOpen] = useState(false)
  return <Search className={className} open={open} setOpen={setOpen} />
}
