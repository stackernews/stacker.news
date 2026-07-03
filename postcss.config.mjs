const config = {
  plugins: {
    '@tailwindcss/postcss': {},
    'postcss-preset-env': {
      autoprefixer: { flexbox: 'no-2009' },
      stage: 3,
      features: { 'custom-properties': false }
    }
  }
}

export default config
