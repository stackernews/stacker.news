# Spark

Spark uses `MAINNET` when `NODE_ENV=production` and `REGTEST` otherwise. The SDK talks to hosted Lightspark infrastructure; there is no local SSP, and hosted `REGTEST` does not peer with `sndev`'s LND.

New Spark wallets generate a BIP-39 mnemonic and derive their receive identity from it.

## Testing

For a real integration check against hosted `REGTEST`, generate a 12-word payer mnemonic:

```bash
docker exec app node --input-type=module -e "import { generateMnemonic } from '@scure/bip39'; import { wordlist } from '@scure/bip39/wordlists/english'; console.log(generateMnemonic(wordlist, 128))"
```

Put it in a local env file without quotes. Docker preserves quotes in `--env-file` values, causing the SDK to parse the mnemonic incorrectly.

```bash
# .env.spark-live — covered by the .env* gitignore rule; never commit it
SPARK_PAYER_MNEMONIC=word1 word2 ... word12
```

Print the payer's Spark address and fresh balance:

```bash
docker exec --env-file .env.spark-live app npx tsx -e "import('@buildonspark/spark-sdk').then(async ({ SparkWallet }) => { const { wallet } = await SparkWallet.initialize({ mnemonicOrSeed: process.env.SPARK_PAYER_MNEMONIC, options: { network: 'REGTEST', optimizationOptions: { auto: false } } }); try { console.log('address', await wallet.getSparkAddress()); console.log('balance', await wallet.getBalance()) } finally { await wallet.cleanup() } })"
```

Fund that address through the [Lightspark regtest faucet](https://app.lightspark.com/regtest-faucet). Faucet delivery can be asynchronous; wait until `satsBalance.available` is nonzero before running the test.

```bash
docker exec --env-file .env.spark-live app npm run test:spark-live
```

The command generates temporary service and receiver wallets and refuses to run when `NODE_ENV=production`. A submission result of `PENDING` is expected: the test polls both the outgoing payment and incoming invoice until they settle, then verifies the preimage, received amount, and unfunded-send failure classification. Success ends with `live Spark E2E ok`.

## Production

Spark receive requires `SPARK_SERVICE_MNEMONIC` in both web and worker environments. Spark is restricted to `SN_ADMIN_IDS` in production until the integration is ready for wider use.
