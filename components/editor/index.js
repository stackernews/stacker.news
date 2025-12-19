import { useState } from 'react'
import dynamic from 'next/dynamic'
import Editor from './editor'

export function SNEditor ({ ...props }) {
  return <Editor {...props} />
}

const Reader = dynamic(() => import('./reader'), { ssr: false })

export function SNReader ({ html, ...props }) {
  const [ready, setReady] = useState(false)

  return (
    <>
      {!ready && <div dangerouslySetInnerHTML={{ __html: html }} />}
      <Reader onReady={() => setReady(true)} {...props} />
    </>
  )
}
