import { useRef, useState } from 'react'
import Search from './search'

export { MobileSearch } from './mobile'
export { SearchStateProvider } from './state'

export default function SearchBar ({ className }) {
  const [open, setOpen] = useState(false)
  const inputRef = useRef(null)
  return <Search className={className} open={open} setOpen={setOpen} inputRef={inputRef} />
}
