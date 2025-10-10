import { useRef, useEffect } from 'react'
import katex from 'katex'

export default function KatexRenderer ({ equation, inline, onDoubleClick }) {
  const katexElementRef = useRef(null)

  useEffect(() => {
    const katexElement = katexElementRef.current
    if (!katexElement) return

    katex.render(equation, katexElement, {
      displayMode: !inline,
      errorColor: '#cc0000',
      output: 'html',
      strict: 'warn',
      throwOnError: false,
      trust: false
    })
  }, [equation, inline])

  return (
    <>
      <img
        src='data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'
        width={0}
        height={0}
        alt=''
      />
      <span
        role='button'
        tabIndex={-1}
        onDoubleClick={onDoubleClick}
        ref={katexElementRef}
      />
      <img
        src='data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'
        width={0}
        height={0}
        alt=''
      />
    </>
  )
}
