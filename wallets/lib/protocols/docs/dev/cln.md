# CLNRest

to attach sending:

- socket: `localhost:9092`
- rune with balance: `sndev cli cln --regtest createrune restrictions='[["method=pay","method=bkpr-listbalances"]]'`
- rune without balance: `sndev cli cln --regtest createrune restrictions='[["method=pay"]]'`

to attach receiving:

- socket: `cln:3010` or onion via `sndev onion cln`
- rune: `sndev cli cln --regtest createrune restrictions='[["method=invoice"]]'`
