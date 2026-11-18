import reactStringReplace from 'react-string-replace'

export default function SearchHighlight ({ text }) {
  return reactStringReplace(text, /\*\*\*([^*]+)\*\*\*/g, (match, i) => <mark key={i}>{match}</mark>)
}
