import { createContext, useContext } from 'react'
// import { useQuery } from '@apollo/client'
// import { useDomain } from '../territory-domains'
// import { GET_TERRITORY_BRANDING } from '@/fragments/branding'
// import Head from 'next/head'

const defaultBranding = {
  primaryColor: '#FADA5E',
  secondaryColor: '#F6911D',
  title: 'Stacker News',
  logo: null,
  favicon: null
}

const BrandingContext = createContext(defaultBranding)

export const BrandingProvider = ({ children }) => {
  // const { isCustomDomain } = useDomain()
  // const [branding, setBranding] = useState(defaultBranding)

  // if on a custom domain, fetch and cache the branding
  // const { data } = useQuery(GET_TERRITORY_BRANDING, {
  //   skip: !isCustomDomain,
  //   fetchPolicy: 'cache-and-network'
  // })

  // useEffect(() => {
  //   if (data?.territoryBranding) {
  //     setBranding({
  //       ...defaultBranding,
  //       ...data.territoryBranding
  //     })
  //   }
  // }, [data])

  return (
    // <BrandingContext.Provider value={branding}>
    //   {isCustomDomain && branding.title && (
    //     <Head>
    //       <title>{branding.title}</title>
    //     </Head>
    //   )}
    //   {children}
    // </BrandingContext.Provider>
    <div>todo</div>
  )
}

export const useBranding = () => useContext(BrandingContext)
