import { Component } from 'react'
import { StaticLayout } from './layout'
import styles from '../styles/error.module.css'
import Image from 'react-bootstrap/Image'

class ErrorBoundary extends Component {
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
        <StaticLayout>
          <Image width='500' height='375' className='rounded-1 shadow-sm' src={`${process.env.NEXT_PUBLIC_ASSET_PREFIX}/floating.gif`} fluid />
          <h1 className={styles.status} style={{ fontSize: '48px' }}>something went wrong</h1>
        </StaticLayout>
      )
    }

    // Return children components in case of no error

    return this.props.children
  }
}

export default ErrorBoundary
