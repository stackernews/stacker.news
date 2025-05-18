# Wallets

// TODO(wallet-v2): this will probably need an update

Every wallet that you can see at [/wallets](https://stacker.news/wallets) is implemented as a plugin in this directory.

This README explains how you can add another wallet for use with Stacker News.

> [!NOTE]
> Plugin means here that you only have to implement a common interface in this directory to add a wallet.

## Plugin interface

Every wallet is defined inside its own directory. Every directory must contain an _index.js_ and a _client.js_ file.

An index.js file exports properties that can be shared by the client and server.

Wallets that have spending permissions / can pay invoices export the payment interface in client.js. These permissions are stored on the client.[^1]

[^1]: unencrypted in local storage until we have implemented encrypted local storage.

A _server.js_ file is only required for wallets that support receiving by exposing the corresponding interface in that file. These wallets are stored on the server because payments are coordinated on the server so the server needs to generate these invoices for receiving. Additionally, permissions to receive a payment are not as sensitive as permissions to send a payment (highly sensitive!).

> [!NOTE]
> Every wallet must have a client.js file (even if it does not support paying invoices) because every wallet is imported on the client. This is not the case on the server. On the client, wallets are imported via
>
> ```js
> import wallet from '@/wallets/<name>/client'
> ```
>
> vs
>
> ```js
> import wallet from '@/wallets/<name>/server'
> ```
>
> on the server.
>
> To have access to the properties that can be shared between client and server, server.js and client.js always reexport everything in index.js with a line like this:
>
> ```js
> export * from '@/wallets/<name>'
> ```
>
> If a wallet does not support paying invoices, this is all that client.js of this wallet does. The reason for this structure is to make sure the client does not import dependencies that can only be imported on the server and would thus break the build.

> [!TIP]
> Don't hesitate to use the implementation of existing wallets as a reference.

### index.js

An index.js file exports the following properties that are shared by imports of this wallet on the server and wallet:

- `name: string`

This acts as an ID for this wallet on the client. It therefore must be unique across all wallets and is used throughout the code to reference this wallet. This name is also shown in the [wallet logs](https://stacker.news/wallet/logs).

- `shortName?: string`

This is an optional value. Set this to true if your wallet needs to be configured per device and should thus not be synced across devices.

- `fields: WalletField[]`

Wallet fields define what this wallet requires for configuration and thus are used to construct the forms like the one you can see at [/wallets/lnbits](https://stacker.news/walletslnbits).

- `card: WalletCard`

Wallet cards are the components you can see at [/wallets](https://stacker.news/wallets). This property customizes this card for this wallet.

- `validate: (config) => void`

This is an optional function that's passed the final config after it has been validated. Validation is otherwise done on each individual field in `fields. This function can be used to implement additional validation logic. If the validation fails, the function should throw an error with a descriptive message for the user.

This validation is triggered on save.

- `walletType?: string`

This field is only required if this wallet supports receiving payments. It must match a value of the enum `WalletType` in the database.

- `walletField?: string`

Just like `walletType`, this field is only required if this wallet supports receiving payments. It must match a column in the `Wallet` table.

> [!NOTE]
> This is the only exception where you have to write code outside this directory for a wallet that supports receiving: you need to write a database migration to add a new enum value to `WalletType` and column to `Wallet`. See the top-level [README](../README.md#database-migrations) for how to do this.

#### WalletField

A wallet field is an object with the following properties:

- `name: string`

The configuration key. This is used by [Formik](https://formik.org/docs/overview) to map values to the correct input. This key is also what is used to save values in local storage or the database. For wallets that are stored on the server, this must therefore match a column in the corresponding table for wallets of this type.

- `label: string`

The label of the configuration key. Will be shown to the user in the form.

- `type: 'text' | 'password'`

The input type that should be used for this value. For example, if the type is `password`, the input value will be hidden by default using a component for passwords.

- `validate: Yup.Schema | ((value) => void) | RegExp`

This property defines how the value for this field should be validated. If a [Yup schema](https://github.com/jquense/yup?tab=readme-ov-file#object) is set, it will be used. Otherwise, the value will be validated by the function or the RegExp. When using a function, it is expected to throw an error with a descriptive message if the value is invalid.

The validate field is required.

- `optional?: boolean | string = false`

This property can be used to mark a wallet field as optional. If it is not set, we will assume this field is required else 'optional' will be shown to the user next to the label. You can use Markdown to customize this text.

- `help?: string | { label: string, text: string }`

If this property is set, a help icon will be shown to the user. On click, the specified text in Markdown is shown. If you additionally want to customize the icon label, you can use the object syntax.

- `editable?: boolean = true`

If this property is set to `false`, you can only configure this value once. Afterwards, it's read-only. To configure it again, you have to detach the wallet first.

- `placeholder?: string = ''`

Placeholder text to show an example value to the user before they click into the input.

- `hint?: string = ''`

If a hint is set, it will be shown below the input.

- `clear?: boolean = false`

If a button to clear the input after it has been set should be shown, set this property to `true`.

- `autoComplete?: HTMLAttribute<'autocomplete'>`

This property controls the HTML `autocomplete` attribute. See [the documentation](https://developer.mozilla.org/en-US/docs/Web/HTML/Attributes/autocomplete) for possible values. Not setting it usually means that the user agent can use autocompletion. This property has no effect for passwords. Autocompletion is always turned off for passwords to prevent passwords getting saved for security reasons.

- `clientOnly?: boolean = false`

If this property is set to `true`, this field is only available on the client. If the stacker has device sync enabled, this field will be encrypted before being synced across devices. Otherwise, the field will be stored only on the current device.

- `serverOnly?: boolean = false`

If this property is set to `true`, this field is only meant to be used on the server and is safe to sync across devices in plain text.

If neither `clientOnly` nor `serverOnly` is set, the field is assumed to be used on both the client and the server and safe to sync across devices in plain text.

#### WalletCard

- `title: string`

The card title.

- `subtitle: string`

The subtitle that is shown below the title if you enter the configuration form of a wallet.

- `image: { src: string, ... }`

The image props that will be used to show an image inside the card. Should contain at least the `src` property.

### client.js

A wallet that supports paying invoices must export the following properties in client.js which are only available if this wallet is imported on the client:

- `testSendPayment: async (config, context) => Promise<void>`

`testSendPayment` will be called during submit on the client to validate the configuration (that is passed as the first argument) more thoroughly than the initial validation by `fieldValidation`. It contains validation code that should only be called during submits instead of possibly on every change like `fieldValidation`.

How this validation is implemented depends heavily on the wallet. For example, for NWC, this function attempts to fetch the info event from the relay specified in the connection string whereas for LNbits, it makes an HTTP request to /api/v1/wallet using the given URL and API key.

This function must throw an error if the configuration was found to be invalid.

The `context` argument is an object. It makes the wallet logger for this wallet as returned by `useWalletLogger` available under `context.logger`. See [wallets/logger.js](../wallets/logger.js).

- `sendPayment: async (bolt11: string, config, context) => Promise<string>`

`sendPayment` will be called if a payment is required. Therefore, this function should implement the code to pay invoices from this wallet.

The first argument is the [BOLT11 payment request](https://github.com/lightning/bolts/blob/master/11-payment-encoding.md). The `config` argument is the current configuration of this wallet (that was validated before). The `context` argument is the same as for `testSendPayment`. The function should return the preimage on payment success.

> [!IMPORTANT]
> As mentioned above, this file must exist for every wallet and at least reexport everything in index.js so make sure that the following line is included:
>
> ```js
> // wallets/<wallet>/client.js
> export * from '@/wallets/<name>'
> ```
>
> where `<name>` is the wallet directory name.

> [!IMPORTANT]
> After you're done implementing the interface, you need to import this wallet in _wallets/client.js_ and add it to the array that is the default export of that file to make this wallet available across the code:
>
> ```diff
> // wallets/client.js
> import * as nwc from '@/wallets/nwc/client'
> import * as lnbits from '@/wallets/lnbits/client'
> import * as lnc from '@/wallets/lnc/client'
> import * as lnAddr from '@/wallets/lightning-address/client'
> import * as cln from '@/wallets/cln/client'
> import * as lnd from '@/wallets/lnd/client'
> + import * as newWallet from '@/wallets/<name>/client'
>
> - export default [nwc, lnbits, lnc, lnAddr, cln, lnd]
> + export default [nwc, lnbits, lnc, lnAddr, cln, lnd, newWallet]
> ```

### server.js

A wallet that supports receiving must export the following properties in server.js which are only available if this wallet is imported on the server:

- `testCreateInvoice: async (config, context) => Promise<void>`

`testCreateInvoice` is called on the server during submit and can thus use server dependencies like [`ln-service`](https://github.com/alexbosworth/ln-service).

It should attempt to create a test invoice to make sure that this wallet can later create invoices for receiving.

Again, like `testSendPayment`, the first argument is the wallet configuration that we should validate and this should thrown an error if validation fails. However, unlike `testSendPayment`, the `context` argument here contains `me` (the user object) and `models` (the Prisma client).

- `createInvoice: async (invoiceParams, config, context) => Promise<bolt11: string>`

`createInvoice` will be called whenever this wallet should receive a payment. It should return a BOLT11 payment request. The first argument `invoiceParams` is an object that contains the invoice parameters. These include `msats`, `description`, `descriptionHash` and `expiry`. The second argument `config` is the current configuration of this wallet. The third argument `context` is the same as in `testCreateInvoice` except it also includes `lnd` which is the return value of [`authenticatedLndGrpc`](https://github.com/alexbosworth/ln-service?tab=readme-ov-file#authenticatedlndgrpc) using the SN node credentials.


> [!IMPORTANT]
> Don't forget to include the following line:
>
> ```js
> // wallets/<wallet>/server.js
> export * from '@/wallets/<name>'
> ```
>
> where `<name>` is the wallet directory name.

> [!IMPORTANT]
> After you're done implementing the interface, you need to import this wallet in _wallets/server.js_ and add it to the array that is the default export of that file to make this wallet available across the code:
>
> ```diff
> // wallets/server.js
> import * as lnd from '@/wallets/lnd/server'
> import * as cln from '@/wallets/cln/server'
> import * as lnAddr from '@/wallets/lightning-address/server'
> + import * as newWallet from '@/wallets/<name>/client'
>
> - export default [lnd, cln, lnAddr]
> + export default [lnd, cln, lnAddr, newWallet]
> ```