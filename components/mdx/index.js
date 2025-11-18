import dynamic from 'next/dynamic'
import { forwardRef } from 'react'

const Editor = dynamic(() => import('./editor'), { ssr: false })

export const SNMDXEditor = forwardRef((props, ref) =>
  <Editor {...props} editorRef={ref} />
)
