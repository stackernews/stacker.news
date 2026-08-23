# deadbolt11

A library to gate syntactically invalid BOLT-11 invoices before processing with
extreme strictness. This prevents abuse of ambiguous wording in the BOLT-11 spec
and serves as a firewall and a filter for computationally expensive semantic
validation against implementations.

### Rationale for syntactic strictness

The library performs checks with role-agnosticism. This means that as a reader,
we check writer rules, and vice versa, because:

1. As a reader, we do not want to interact with writers that violate the spec.
   Such a writer is either malicious or buggy, and rejecting these outright
   protects the integration from being tricked into accepting invoices that
   should per the spec have never been written.
2. As a writer, we want generated invoices to not be rejected by consuming
   clients. Any client that would accept a malicious or buggy invoice is a
   counterparty put at risk, and every integration that exploits that is itself
   buggy or malicious.

In some cases, the BOLT-11 spec is vague, and in this case we err on the side of
rejection.

#### Implementation that is specifically stricter than the BOLT-11 spec:

Non-configurable:

- `MAX_INVOICE_LENGTH` is hardcoded `7089`, this matches LND's maximum invoice
  length and functions as an anti-DoS measure. There is no point in allowing an
  invoice that will per definition be rejected by LND.

Configurable:

- `strict-known-f-witness-program` and `fallback-address-size-rule` are
  rejecting anything that is currently (31.x) not active in Bitcoin Core
  mainnet. Instead of skipping, we reject.
- Bad sized (`p`, `s`, `h` and `n`) are rejected instead of skipped. Since these
  fields are unary from a writer perspective, if one field is invalid then the
  only field is invalid and we don't tolerate invalid fields. Rules:
    - `fixed-length-p`
    - `fixed-length-s`
    - `fixed-length-h`
    - `fixed-length-n`
- `optional-one-m-field` is a consequence of the language in the spec describing
  it as singular (there is however no explicit rule stating that it MUST be)

See "Removing a rule" below when you need to get rid of any of these.

### Integration

Integrate this library on every receive path of a bolt11 string, external and
internal to the whole system, before any other BOLT-11 parsing or processing
takes place, to have a firewall that saves expensive signature validation.

### Usage

```javascript
import { Bolt11SyntaxValidator } from 'deadbolt11/syntax-validator.js'
import { Bolt11SyntaxError } from 'deadbolt11/error.js'
const BOLT11_CURRENCY = 'bc' // bcrt for regtest
const validator = new Bolt11SyntaxValidator(BOLT11_CURRENCY)
const assertValidBolt11 = validator.build(/* failFast = */ true) // validator.lazy(true) for
                                                // a lazily initialized function
                                                // for i.e. in a web front-end
// ...
assertValidBolt11(bolt11) // throws Bolt11SyntaxError

```

### Structure

- `decoder.js`: the decoding framework.
- `error.js`: the shared `Bolt11SyntaxError`
- `rules.js`: constructors and logic for BOLT-11 validation rules
- `syntax-validator.js`: ruleset composition and the factory `Bolt11SyntaxValidator`

### Customization

By default, all standard, non-plugin rules are checked. Rules can be added
and removed on demand, for example in experimental setups.

#### Adding a new rule

```javascript
import { Rule } from 'deadbolt11/rules.js'
const validator = new Bolt11SyntaxValidator(BOLT11_CURRENCY)
validator.addRule(new Rule('your-rule-name', (data) => doSomethingWith(data), 'Your error message'))
const assertValidBolt11Verbosely = validator.build(/* failFast = */ false)
```

#### Removing a rule

```javascript
const validator = new Bolt11SyntaxValidator(BOLT11_CURRENCY)
validator.excludeRules(['exactly-one-s-field']) // we like hashing candidates
const assertValidBolt11LikeAMiner = validator.build(/* failFast = */ true)
```

To check what rules are defined, see `Bolt11SyntaxValidator.ruleNames()`, or
when troubleshooting, build with `/* failFast = */ false` to see the rule name
prepended to each failure.

#### Plugins

Currently, a plugin for bLIP-39 is built-in:

```javascript
const validator = new Bolt11SyntaxValidator(BOLT11_CURRENCY)
validator.allowBlip39() // allow bLIP39 invoices (no `s`, added `b` tags(s))
const assertValidBolt11LikeAMiner = validator.build(/* failFast = */ true)
```

### Dependencies

There is a ***hard*** dependency on `bech32=2.0.0`, due to the reliance on
the decoder returning specific strings. Ideally, this dependency is removed in
the future by removing the dependency entirely.
