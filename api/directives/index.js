import { makeExecutableSchema } from '@graphql-tools/schema'

import * as upper from './upper'
import * as auth from './auth'

const DIRECTIVES = [upper, auth]

export function makeExecutableSchemaWithDirectives (typeDefs, resolvers) {
  const schema = makeExecutableSchema({
    typeDefs: [...typeDefs, ...DIRECTIVES.map(({ typeDef }) => typeDef)],
    resolvers
  })
  return DIRECTIVES.reduce((acc, directive) => directive.apply(acc), schema)
}
