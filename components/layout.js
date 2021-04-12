import Header from './header'

export default function Layout ({ children }) {
  return (
    <>
      <Header />
      {children}
    </>
  )
}
