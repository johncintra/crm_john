export default () => ({
  app: {
    port: Number(process.env.PORT ?? 3000),
    corsOrigin: process.env.CORS_ORIGIN ?? ''
  },
  jwt: {
    secret: process.env.JWT_SECRET ?? 'change-me-super-secret',
    expiresIn: process.env.JWT_EXPIRES_IN ?? '7d'
  }
});
