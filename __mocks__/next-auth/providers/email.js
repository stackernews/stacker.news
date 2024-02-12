module.exports = () => ({
  id: 'email',
  name: 'email',
  type: 'Email',
  server: {},
  from: '',
  maxAge: 24 * 60 * 60,
  sendVerificationRequest: jest.fn().mockResolvedValue({})
})
