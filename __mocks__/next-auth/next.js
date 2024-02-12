export class AuthError extends Error {
  type
  constructor (type) {
    super(type)
    this.type = type
  }
}

const NextAuth = () => ({
  auth: jest.fn(),
  signIn: jest.fn(),
  signOut: jest.fn(),
  handlers: {
    GET: jest.fn(),
    POST: jest.fn()
  },
  AuthError
})

export const getServerSession = jest.fn().mockResolvedValue({})

export default NextAuth
