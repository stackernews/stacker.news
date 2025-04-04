import { gql } from 'graphql-tag'

export const GET_CUSTOM_BRANDING = gql`
  query CustomBranding($subName: String!) {
    customBranding(subName: $subName) {
      title
      colors
      logoId
      faviconId
      subName
    }
  }
`

export const GET_CUSTOM_BRANDING_FIELDS = gql`
  fragment CustomBrandingFields on CustomBranding {
    title
    colors
    logoId
    faviconId
    subName
  }
`

export const SET_CUSTOM_BRANDING = gql`
  ${GET_CUSTOM_BRANDING_FIELDS}
  mutation SetCustomBranding($subName: String!, $branding: CustomBrandingInput!) {
    setCustomBranding(subName: $subName, branding: $branding) {
      ...CustomBrandingFields
    }
  }
`
