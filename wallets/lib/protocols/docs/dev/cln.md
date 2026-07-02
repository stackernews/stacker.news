# CLNRest

to attach sending:

- socket: `localhost:9092`
- rune with proof recovery and balance: `sndev cli cln --regtest createrune restrictions='[["method=pay","method=listpays","method=bkpr-listbalances"]]'`
- rune without balance: `sndev cli cln --regtest createrune restrictions='[["method=pay"]]'`

to attach receiving:

- socket: `cln:3010` or onion via `sndev onion cln`
- rune with proof recovery: `sndev cli cln --regtest createrune restrictions='[["method=invoice","method=listinvoices"]]'`
- receive-only rune: `sndev cli cln --regtest createrune restrictions='[["method=invoice"]]'`
