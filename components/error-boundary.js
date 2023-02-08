import React from 'react'
import LayoutError from './layout-error'
import styles from '../styles/404.module.css'

class ErrorBoundary extends React.Component {
  constructor (props) {
    super(props)

    // Define a state variable to track whether is an error or not
    this.state = { hasError: false }
  }

  static getDerivedStateFromError () {
    // Update state so the next render will show the fallback UI
    return { hasError: true }
  }

  componentDidCatch (error, errorInfo) {
    // You can use your own error logging service here
    console.log({ error, errorInfo })
  }

  render () {
    // Check if the error is thrown
    if (this.state.hasError) {
      // You can render any custom fallback UI
      return (
        <LayoutError>
          <Image width='500' height='375' src='/floating.gif' fluid />
          <h1 className={styles.fourZeroFour} style={{ fontSize: '48px' }}>something went wrong</h1>
        </LayoutError>
      )
    }

    // Return children components in case of no error

    return this.props.children
  }
}

export default ErrorBoundary
