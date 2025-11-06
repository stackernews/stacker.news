import gql from 'graphql-tag'
import { defaultFieldResolver } from 'graphql'
import { getDirective, MapperKind, mapSchema } from '@graphql-tools/utils'

/** Example schema directive that uppercases the value of the field before returning it to the client */

const DIRECTIVE_NAME = 'upper'

export const typeDef = gql`directive @${DIRECTIVE_NAME} on FIELD_DEFINITION`

export function apply (schema) {
  return mapSchema(schema, {
    [MapperKind.OBJECT_FIELD]: fieldConfig => {
      const upperDirective = getDirective(schema, fieldConfig, DIRECTIVE_NAME)?.[0]
      if (upperDirective) {
        const { resolve = defaultFieldResolver } = fieldConfig
        return {
          ...fieldConfig,
          resolve: async function (parent, args, context, info) {
            const result = await resolve(parent, args, context, info)
            if (typeof result === 'string') {
              return result.toUpperCase()
            }
            return result
          }
        }
      }
    }
  })
}
