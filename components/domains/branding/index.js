import { createContext, useContext, useState, useEffect } from 'react'
import CustomStyles from './custom-styles'
import Head from 'next/head'
import { useQuery } from '@apollo/client'
import { GET_CUSTOM_BRANDING } from '@/fragments/brandings'
import { useDomain } from '@/components/domains/territory-domains'

const defaultBranding = {
  primaryColor: '#FADA5E',
  secondaryColor: '#F6911D',
  title: 'stacker news',
  logo: null,
  favicon: null
}

const BrandingContext = createContext(defaultBranding)

export const BrandingProvider = ({ children, customBranding }) => {
  const { customDomain } = useDomain()
  const [branding, setBranding] = useState(customBranding)

  const { data } = useQuery(GET_CUSTOM_BRANDING, {
    skip: !!customBranding,
    variables: {
      subName: customDomain?.subName
    },
    fetchPolicy: 'cache-and-network'
  })

  useEffect(() => {
    if (customBranding) {
      setBranding(customBranding)
    } else if (data) {
      setBranding(data?.customBranding || defaultBranding)
    }
  }, [data, customBranding])

  return (
    <BrandingContext.Provider value={branding}>
      {branding && (
        <>
          <Head>
            {branding?.title && <title>{branding?.title}</title>}
            {branding?.favicon && <link rel='icon' href={branding.favicon} />}
          </Head>
          {branding?.primaryColor && <CustomStyles />}
        </>
      )}
      {children}
    </BrandingContext.Provider>
  )
}

export const useBranding = () => useContext(BrandingContext)
