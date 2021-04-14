import styles from './text.module.css'

export default function Text ({ children }) {
  return (
    <pre className={styles.text}>
      {children}
    </pre>
  )
}
