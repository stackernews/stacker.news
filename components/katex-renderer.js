import { useEffect, useRef } from 'react'

export default function KatexRenderer ({ equation, titleText, inline, onClick }) {
  const katexElementRef = useRef(null)

  useEffect(() => {
    let cancelled = false
    const katexElement = katexElementRef.current
    if (!katexElement) return

    import('katex').then(({ default: katex }) => {
      if (cancelled) return
      katex.render(equation, katexElement, {
        displayMode: !inline,
        errorColor: '#cc0000',
        output: 'html',
        strict: false,
        throwOnError: false,
        trust: false
      })
    })

    return () => {
      cancelled = true
    }
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
        onClick={onClick}
        ref={katexElementRef}
        title={titleText}
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
