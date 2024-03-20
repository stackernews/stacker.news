import { Component } from 'react'
import { StaticLayout } from './layout'
import styles from '@/styles/error.module.css'
import Image from 'react-bootstrap/Image'
import copy from 'clipboard-copy'
import { LoggerContext } from './logger'
import Button from 'react-bootstrap/Button'
import { useToast } from './toast'

class ErrorBoundary extends Component {
  constructor (props) {
    super(props)

    // Define a state variable to track whether is an error or not
    this.state = {
      hasError: false,
      error: undefined,
      errorInfo: undefined
    }
  }

  static getDerivedStateFromError (error) {
    // Update state so the next render will show the fallback UI
    return { hasError: true, error }
  }

  getErrorDetails () {
    let details = this.state.error.stack
    if (this.state.errorInfo?.componentStack) {
      details += `\n\nComponent stack:${this.state.errorInfo.componentStack}`
    }
    return details
  }

  componentDidCatch (error, errorInfo) {
    // You can use your own error logging service here
    console.log({ error, errorInfo })
    this.setState({ errorInfo })
    const logger = this.context
    logger?.error(this.getErrorDetails())
  }

  render () {
    // Check if the error is thrown
    if (this.state.hasError) {
      // You can render any custom fallback UI
      const errorDetails = this.getErrorDetails()
      return (
        <StaticLayout footer={false}>
          <Image width='500' height='375' className='rounded-1 shadow-sm' src={`${process.env.NEXT_PUBLIC_ASSET_PREFIX}/floating.gif`} fluid />
          <h1 className={styles.status} style={{ fontSize: '48px' }}>something went wrong</h1>
          {this.state.error && <CopyErrorButton errorDetails={errorDetails} />}
        </StaticLayout>
      )
    }

    // Return children components in case of no error
    return this.props.children
  }
}

ErrorBoundary.contextType = LoggerContext

export default ErrorBoundary

// This button is a functional component so we can use `useToast` hook, which
// can't be easily done in a class component that already consumes a context
const CopyErrorButton = ({ errorDetails }) => {
  const toaster = useToast()
  const onClick = async () => {
    try {
      await copy(errorDetails)
      toaster?.success?.('copied')
    } catch (err) {
      console.error(err)
      toaster?.danger?.('failed to copy')
    }
  }
  return <Button className='mt-3' onClick={onClick}>copy error information</Button>
}
