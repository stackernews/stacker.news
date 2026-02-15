import { forwardRef } from 'react'
import { isHTMLElement } from '@lexical/utils'

export default forwardRef(function MathEditor ({ math, setMath, inline }, ref) {
  const onChange = (e) => {
    setMath(e.target.value)
  }

  return inline && isHTMLElement(ref)
    ? (
      <div>
        <textarea ref={ref} value={math} onChange={(e) => setMath(e.target.value)} />
      </div>
      )
    : (
      <div>
        <textarea ref={ref} value={math} onChange={onChange} />
      </div>
      )
})
