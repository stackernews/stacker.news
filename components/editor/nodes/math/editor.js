import { forwardRef } from 'react'
import classNames from 'classnames'
import styles from '@/lib/lexical/theme/editor.module.css'

export default forwardRef(function MathEditor ({ math, setMath, inline }, ref) {
  return (
    <div style={{ display: inline ? 'inline-block' : 'block' }}>
      <textarea
        ref={ref}
        value={math}
        onChange={(e) => setMath(e.target.value)}
        className={classNames(styles.mathEditor, inline && styles.inlineMathEditor)}
      />
    </div>
  )
})
