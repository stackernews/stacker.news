import Document, { Html, Head, Main, NextScript } from 'next/document'

class MyDocument extends Document {
  render () {
    return (
      <Html>
        <Head />
        <body>
          <script src='darkmode.js' />
          <Main />
          <NextScript />
        </body>
      </Html>
    )
  }
}

export default MyDocument
