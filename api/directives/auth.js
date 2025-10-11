import gql from 'graphql-tag'
import { defaultFieldResolver } from 'graphql'
import { getDirective, MapperKind, mapSchema } from '@graphql-tools/utils'
import { GqlAuthorizationError } from '@/lib/error'

const DIRECTIVE_NAME = 'auth'

export const typeDef = gql`
    directive @${DIRECTIVE_NAME}(allow: [Role!]!) on FIELD_DEFINITION
    enum Role {
        ADMIN
        OWNER
        USER
    }
`

export function apply (schema) {
  return mapSchema(schema, {
    [MapperKind.OBJECT_FIELD]: fieldConfig => {
      const upperDirective = getDirective(schema, fieldConfig, DIRECTIVE_NAME)?.[0]
      if (upperDirective) {
        const { resolve = defaultFieldResolver } = fieldConfig
        const { allow } = upperDirective
        return {
          ...fieldConfig,
          resolve: async function (parent, args, context, info) {
            checkFieldPermissions(allow, parent, args, context, info)
            return await resolve(parent, args, context, info)
          }
        }
      }
    }
  })
}

function checkFieldPermissions (allow, parent, args, { me }, { parentType }) {
  // TODO: should admin users always have access to all fields?

  if (allow.indexOf('OWNER') >= 0) {
    if (!me) {
      throw new GqlAuthorizationError('you must be logged in to access this field')
    }

    switch (parentType.name) {
      case 'User':
        if (me.id !== parent.id) {
          throw new GqlAuthorizationError('you must be the owner to access this field')
        }
        break
      default:
        // we could just try the userId column and not care about the type
        // but we want to be explicit and throw on unexpected types instead
        // to catch potential issues in our authorization layer fast
        throw new GqlAuthorizationError('failed to check owner: unknown type')
    }
  }
}
