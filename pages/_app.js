import '../styles/globals.scss'
import { ApolloProvider, gql } from '@apollo/client'
import { Provider } from 'next-auth/client'
import { FundErrorModal, FundErrorProvider } from '../components/fund-error'
import { MeProvider, useMe } from '../components/me'
import PlausibleProvider from 'next-plausible'
import { LightningProvider } from '../components/lightning'
import { ItemActModal, ItemActProvider } from '../components/item-act'
import getApolloClient from '../lib/apollo'
import { createGlobalStyle, ThemeProvider } from 'styled-components'

const GlobalStyle = createGlobalStyle`
  body {
    background: ${({ theme }) => theme.body};
    color: ${({ theme }) => theme.color};
  }

  .nav-tabs .nav-link.active, .nav-tabs .nav-item.show .nav-link {
    color: inherit;
    background-color: ${({ theme }) => theme.inputBg};
    border-color: ${({ theme }) => theme.borderColor};
    border-bottom-color: ${({ theme }) => theme.inputBg};
  }

  .form-control {
    background-color: ${({ theme }) => theme.inputBg};
    color: ${({ theme }) => theme.color};
    border-color: ${({ theme }) => theme.borderColor};
  }

  .form-control:focus {
    background-color:  ${({ theme }) => theme.inputBg};
    color: ${({ theme }) => theme.color};
  }

  .form-control:disabled, .form-control[readonly] {
    background-color: ${({ theme }) => theme.inputBg};
    border-color: ${({ theme }) => theme.borderColor};
    opacity: 1;
  }

  .clickToContext {
    border-radius: .4rem;
    padding: .2rem 0;
    cursor: pointer;
  }

  .clickToContext:hover {
    background-color: ${({ theme }) => theme.clickToContextColor};
  }

  .fresh {
    background-color: ${({ theme }) => theme.clickToContextColor};
    border-radius: .4rem;
  }

  .modal-content {
    background-color: ${({ theme }) => theme.body};
    border-color: ${({ theme }) => theme.borderColor};
  }
`

const lightTheme = {
  body: '#f5f5f5',
  color: '#212529',
  navbarVariant: 'light',
  borderColor: '#ced4da',
  inputBg: '#ffffff',
  dropdownItemColor: 'inherit',
  dropdownItemColorHover: 'rgba(0, 0, 0, 0.9)',
  commentBg: 'rgba(0, 0, 0, 0.03)',
  clickToContextColor: 'rgba(0, 0, 0, 0.05)',
  brandColor: 'rgba(0, 0, 0, 0.9)'
}

const darkTheme = {
  body: '#000000',
  inputBg: '#000000',
  navbarVariant: 'dark',
  borderColor: 'rgb(255 255 255 / 50%)',
  dropdownItemColor: 'rgba(255, 255, 255, 0.7)',
  dropdownItemColorHover: 'rgba(255, 255, 255, 0.9)',
  commentBg: 'rgba(255, 255, 255, 0.04)',
  clickToContextColor: 'rgba(255, 255, 255, 0.08)',
  color: '#f8f9fa',
  brandColor: 'var(--primary) !important'
}

function ThemeProviderWrapper ({ children }) {
  const me = useMe()
  console.log(me)
  return (
    <ThemeProvider theme={me?.theme === 'light' ? lightTheme : darkTheme}>
      {children}
    </ThemeProvider>
  )
}

function MyApp ({ Component, pageProps: { session, ...props } }) {
  const client = getApolloClient()
  /*
    If we are on the client, we populate the apollo cache with the
    ssr data
  */
  if (typeof window !== 'undefined') {
    const { apollo, data } = props
    if (apollo) {
      client.writeQuery({
        query: gql`${apollo.query}`,
        data: data,
        variables: apollo.variables
      })
    }
  }

  return (
    <PlausibleProvider domain='stacker.news' trackOutboundLinks>
      <Provider session={session}>
        <ApolloProvider client={client}>
          <MeProvider>
            <ThemeProviderWrapper>
              <GlobalStyle />
              <LightningProvider>
                <FundErrorProvider>
                  <FundErrorModal />
                  <ItemActProvider>
                    <ItemActModal />
                    <Component {...props} />
                  </ItemActProvider>
                </FundErrorProvider>
              </LightningProvider>
            </ThemeProviderWrapper>
          </MeProvider>
        </ApolloProvider>
      </Provider>
    </PlausibleProvider>
  )
}

export default MyApp
