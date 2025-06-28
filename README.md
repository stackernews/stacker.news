<p align="center">
<a href="https://stacker.news">
<img height="50" alt="Internet Communities with Bitcoin Economies" src="https://github.com/stackernews/stacker.news/assets/34140557/a8ccc5dc-c453-46dc-be74-60dd0a42ce09">
</a>
</p>


- Stacker News is trying to fix online communities with economics
- What You See is What We Ship (look ma, I invented an initialism)
- 100% FOSS
- We pay bitcoin for PRs, issues, documentation, code reviews and more
- Next.js, postgres, graphql, and lnd

<br>

# Getting started

Launch a fully featured SN development environment in a single command.

```sh
$ ./sndev start
```

Go to [localhost:3000](http://localhost:3000).

<br>

## Installation

- Clone the repo
   - ssh: `git clone git@github.com:stackernews/stacker.news.git`
   - https: `git clone https://github.com/stackernews/stacker.news.git`
- Install [docker](https://docs.docker.com/compose/install/)
    - If you're running MacOS or Windows, I ***highly recommend***  using [OrbStack](https://orbstack.dev/) instead of Docker Desktop
- Please make sure that at least 10 GB of free space is available, otherwise you may encounter issues while setting up the development environment.

<br>

## Usage

Start the development environment

```sh
$ ./sndev start
```

View all available commands

```sh
$ ./sndev help

                            888
                            888
                            888
      .d8888b  88888b.  .d88888  .d88b.  888  888
     88K      888 '88b d88' 888 d8P  Y8b 888  888
     'Y8888b. 888  888 888  888 88888888 Y88  88P
          X88 888  888 Y88b 888 Y8b.      Y8bd8P
      88888P' 888  888  'Y88888  'Y8888    Y88P

manages a docker based stacker news development environment

USAGE
  $ sndev [COMMAND]
  $ sndev help [COMMAND]

COMMANDS
  help                    show help

  env:
    start                 start env
    stop                  stop env
    restart               restart env
    status                status of env
    logs                  logs from env
    delete                delete env

  sn:
    login                 login as a nym
    set_balance           set the balance of a nym

  lightning:
    fund                   pay a bolt11 for funding
    withdraw               create a bolt11 for withdrawal

  db:
    psql                   open psql on db
    prisma                 run prisma commands

  domains:
    domains                custom domains dev management

  dev:
    pr                     fetch and checkout a pr
    lint                   run linters
    test                   run tests

  other:
    cli                    service cli passthrough
    open                   open service GUI in browser
    onion                  service onion address
    cert                   service tls cert
    compose                docker compose passthrough
```

### Modifying services

#### Running specific services

By default all services will be run. If you want to exclude specific services from running, set `COMPOSE_PROFILES` in a `.env.local` file to one or more of `minimal,images,search,payments,wallets,email,capture`. To only run mininal necessary without things like payments in `.env.local`:

```.env
COMPOSE_PROFILES=minimal
```

To run with images and payments services:

```.env
COMPOSE_PROFILES=images,payments
```

#### Merging compose files

By default `sndev start` will merge `docker-compose.yml` with `docker-compose.override.yml`. Specify any overrides you want to merge with `docker-compose.override.yml`.

For example, if you want to replace the db seed with a custom seed file located in `docker/db/another.sql`, you'd create a `docker-compose.override.yml` file with the following:

```yml
services:
  db:
    volumes:
      - ./docker/db/another.sql:/docker-entrypoint-initdb.d/seed.sql
```

You can read more about [docker compose override files](https://docs.docker.com/compose/multiple-compose-files/merge/).

#### Enabling semantic search

To enable semantic search that uses text embeddings, run `./scripts/nlp-setup`.

Before running `./scripts/nlp-setup`, ensure the following are true:

- search is enabled in `COMPOSE_PROFILES`:

    ```.env
    COMPOSE_PROFILES=...,search,...
    ```
- The default opensearch index (default name=`item`) is created and done indexing. This should happen the first time you run `./sndev start`, but it may take a few minutes for indexing to complete.

After `nlp-setup` is done, restart your containers to enable semantic search:

```
> ./sndev restart
```

#### Local DNS via dnsmasq

To enable dnsmasq:

- domains should be enabled in `COMPOSE_PROFILES`:

    ```.env
    COMPOSE_PROFILES=...,domains,...
    ```

To add/remove DNS records you can now use `./sndev domains dns`. More on this [here](#add-or-remove-dns-records-in-local).

<br>

# Table of Contents
- [Getting started](#getting-started)
    - [Installation](#installation)
    - [Usage](#usage)
        - [Modifying services](#modifying-services)
            - [Running specific services](#running-specific-services)
            - [Merging compose files](#merging-compose-files)
- [Contributing](#contributing)
    - [We pay bitcoin for contributions](#we-pay-bitcoin-for-contributions)
    - [Pull request awards](#pull-request-awards)
    - [Code review awards](#code-review-awards)
    - [Issue specification awards](#issue-specification-awards)
    - [Responsible disclosure of security or privacy vulnerability awards](#responsible-disclosure-of-security-or-privacy-vulnerability-awards)
    - [Development documentation awards](#development-documentation-awards)
    - [Helpfulness awards](#helpfulness-awards)
- [Contribution extras](#contribution-extras)
    - [Dev chat](#dev-chat)
    - [Triage permissions](#triage-permissions)
    - [Contributor badges on SN profiles](#contributor-badges-on-sn-profiles)
    - [What else you got](#what-else-you-got)
- [Development Tips](#development-tips)
    - [Linting](#linting)
    - [Database migrations](#database-migrations)
    - [Connecting to the local database](#connecting-to-the-local-database)
    - [Running lncli on the local lnd nodes](#running-lncli-on-the-local-lnd-nodes)
    - [Testing local auth](#testing-local-auth)
        - [Login with Email](#login-with-email)
        - [Login with Github](#login-with-github)
        - [Login with Lightning](#login-with-lightning)
        - [OAuth Applications](#oauth-applications)
    - [Enabling web push notifications](#enabling-web-push-notifications)
- [Internals](#internals)
    - [Stack](#stack)
    - [Services](#services)
    - [Wallet transaction safety](#wallet-transaction-safety)
- [Need help?](#need-help)
- [Responsible Disclosure](#responsible-disclosure)
- [License](#license)

<br>

# Contributing
We want your help.

<br>

## We pay bitcoin for contributions
- pull requests closing existing issues
- code review
- issue specification whether for bugs, features, or enhancements
- discovery of security vulnerabilities
- discovery of privacy vulnerabilities
- improvements to development documentation
- helpfulness

[View a current list of granted awards](awards.csv)

<br>

## Just in case
*This document in no way legally entitles you to payments for contributions, entitles you to being a contributor, or entitles you to the attention of other contributors. This document lays out the system we **can** use to determine contribution awards which we generally intend to abide by but importantly we reserve the right to refuse payments or contributions, modify rules and award amounts, make exceptions to rules or reward amounts, and withhold awards for any reason at anytime, even just for the heck of it, at our sole discretion. If you need more certainty than what I've just described, don't participate. We provide awards as an experiment to make FOSS less sucky.*

<br>

## Pull request awards

###  Rules
1. PRs closing an issue will be awarded according to the `difficulty` tag on an issue,  e.g. `difficulty:easy` pays 100k sats.
2. Issues are occasionally marked with a `priority` tag which multiplies the award of a PR closing an issue, e.g. an issue marked with `priority:high` and `difficulty:hard` awards 2m sats.
3. An award is reduced by 10% of the award amount for each substantial change requested to the PR on code review, e.g. if two changes are requested on a PR closing an issue tagged with `difficulty:hard`, 800k sats will be awarded.
	- Reductions are applied before `priority` multipliers, e.g. a PR closing a `priority:high` and `difficulty:hard` issue that's approved after two changes are requested awards 1.6m sats.
	- You are responsible for understanding the issue and requirements **before requesting review on a PR**.
	- There is no award reduction for asking specific questions on the issue itself or on the PR **before requesting review**
	- There is no award reduction for asking more general questions in a discussion
4. A PR must be merged by an SN engineer before a PR receives an award

_Due to Rule 3, make sure that you mark your PR as a draft when you create it and it's not ready for review yet._

### Difficulty award amounts

| tag                           | description                                                                                                                                                                                      | award       |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------- |
| `difficulty:good-first-issue` | at most a couple lines of code in a couple files and does not require much familiarity with the codebase                                                                                         | `20k sats`  |
| `difficulty:easy`             | at most a couple lines of code in a couple files but does require familiarity with the code base                                                                                                 | `100k sats` |
| `difficulty:medium`           | more code, more places and could require adding columns in the db and some modification chunky db queries                                                                                        | `250k sats` |
| `difficulty:medium-hard`      | even more code, even more places and requires either more sophisticated logic, more significant db modeling eg adding a table, and/or a deeper study of a something                              | `500k sats` |
| `difficulty:hard`             | either a bigger lift than the what's required of medium-hard or very tricky in a particular way that might not require a lot of code but does require a lot of context/troubleshooting/expertise | `1m sats`   |

### Priority multipliers

| tag               | multiplier |
| ----------------- | ---------- |
| `priority:low`    | 0.5        |
| `priority:medium` | 1.5        |
| `priority:high`   | 2          |
| `priority:urgent` | 3          |

### Requesting modifications to reward amounts
We try to assign difficulty and priority tags to issues accurately, but we're not perfect. If you believe an issue is mis-tagged, you can request a change to the issue's tags.

<br>

## Code review awards

Code reviewers will be awarded the amount their code review reduced from the PR author's reward, e.g. two substantial problems/areas of improvement identified in a PR closing a `priority:high` and `difficulty:hard` issue awards 400k sats.

### Rules
1. The problem or improvement must be acknowledged as such by SN engineers explicitly
2. A PR must be merged by an SN engineer before a PR's code reviewers receive an award

Code review approvals are more than welcome, but we can't guarantee awards for them because the work performed to approve a PR is unverifiable.

<br>

## Issue specification awards

Issue specifiers will be awarded up to 10% of a PR award for issues resulting in a PR being merged by an SN engineer that closes the issue. In addition to being subject to PR award amounts and reductions, specification amounts are awarded on the basis of how much additional help and specification is required by other contributors.

### Rules
1. The issue must directly result in PR being merged by an SN engineer that closes the issue
2. Issue specification award amounts are based on the final PR award amounts
	- that is, they are subject to PR award code review reductions and priority multipliers
3. Award amounts will be reduced on the basis of how much additional help and specification is required by other contributors
4. Issue specifiers who can close their own issues with their own PRs are also eligible for this 10%
    - e.g an issue tagged as `difficulty:hard` that is both specified and closed by a PR from the same contributor without changes requested awards 1.1m sats

### Relative awards

| circumstances                                                                                              | award |
| ---------------------------------------------------------------------------------------------------------- | ----- |
| issue doesn't require further help and/or specification from other contributors                            | 10%   |
| issue requires little help and/or specification from other contributors                                    | 5%    |
| issue requires more help and/or specification from other contributors than the issue specifier contributed | 1%    |
| issue is vague and/or incomplete and must mostly be entirely specified by someone else                     | 0%    |

For example: a specified issue that's tagged as `difficulty:hard`, doesn't require additional specification and disambiguation by other contributors, and results in PR being merged without changes requested awards the issue specifier 100k sats.

<br>

## Responsible disclosure of security or privacy vulnerability awards

Awards for responsible disclosures are assessed on the basis of:

1. the potential loss resulting from an exploit of the vulnerability
2. the trivialness of exploiting the vulnerability
3. the disclosure's detail

Award amounts will be easiest to assess on a case by case basis. Upon confirmation of a vulnerability, we agree to award responsible disclosures at minimum 100k sats and as high as the total potential loss that would result from exploiting the vulnerability.

### Rules
1. Disclosure is responsible and does not increase the likelihood of an exploit.
2. Disclosure includes steps to reproduce.
3. Disclosure includes a realistic attack scenario with prerequisites for an attack and expected gains after the exploitation. Disclosures without such scenario, with unrealistic assumptions or without meaningful outcomes will not be eligible for awards.
4. You must be the first person to responsibly disclose the issue to be eligible for awards.

<br>

## Development documentation awards

For significant changes to documentation, create an issue before making said changes. In such cases we will award documentation improvements in accordance with issue specification and PR awards.

For changes on the order of something like a typo, we'll award a nominal amount at our discretion.

<br>

## Helpfulness awards

Like issue specification awards, helping fellow contributors substantially in a well documented manner such that the helped fellow contributes a merged PR is eligible for a one-time relative reward.

| circumstances                                                                          | award |
| -------------------------------------------------------------------------------------- | ----- |
| substantial and singular source of help                                                | 10%   |
| substantial but nonsingular source of help                                             | 1-5%  |
| source of relatively trivial help                                                      | 1%    |

<br>

# Contribution extras
We want to make contributing to SN as rewarding as possible, so we offer a few extras to contributors.

## Dev chat
We self-host a private chat server for contributors to SN. If you'd like to join, please respond in this [discussion](https://github.com/stackernews/stacker.news/discussions/1059).

## Triage permissions
We offer triage permissions to contributors after they've made a few contributions. I'll usually add them as I notice people contributing, but if I missed you and you'd like to be added, let me know!

## Contributor badges on SN profiles
Contributors can get badges on their SN profiles by opening a pull request adding their SN nym to the [contributors.txt](/contributors.txt) file.

## What else you got
In the future we plan to offer more, like gratis github copilot subscriptions, reverse tunnels, codespaces, and merch.

If you'd like to see something added, please make a suggestion.

<br>

# Development Tips

<br>

## Linting

We use [JavaScript Standard Style](https://standardjs.com/) to enforce code style and correctness. You should run `sndev lint` before submitting a PR.

If you're using VSCode, you can install the [StandardJS VSCode Extension](https://marketplace.visualstudio.com/items?itemName=standard.vscode-standard) extension to get linting in your editor. We also recommend installing [StandardJS code snippets](https://marketplace.visualstudio.com/items?itemName=capaj.vscode-standardjs-snippets) and [StandardJS react code snippets](https://marketplace.visualstudio.com/items?itemName=TimonVS.ReactSnippetsStandard) for code snippets.

<br>

## Database migrations

We use [prisma](https://www.prisma.io/) for our database migrations. To create a new migration, modify `prisma/schema.prisma` according to [prisma schema reference](https://www.prisma.io/docs/orm/reference/prisma-schema-reference) and apply it with:

`./sndev prisma migrate dev`

If you want to create a migration without applying it, eg to create a trigger or modify the generated sql before applying, use the `--create-only` option:

`./sndev prisma migrate dev --create-only`

Generate the local copy of the prisma ORM client in `node_modules` after changes. This should only be needed to get Intellisense in your editor locally.

`./sndev prisma generate`

<br>

## Connecting to the local database

You can connect to the local database via `./sndev psql`. [psql](https://www.postgresql.org/docs/13/app-psql.html) is an interactive terminal for working with PostgreSQL.

<br>

## Running cli on local lightning nodes

You can run `lncli` on the local lnd nodes via `./sndev cli lnd` and `./sndev cli sn_lnd`. The node for your local SN instance is `sn_lnd` and the node serving as any external node, like a stacker's node or external wallet, is `lnd`.

You can run `lightning-cli` on the local cln node via `./sndev cli cln` which serves as an external node or wallet.

<br>

## Testing local auth

You can login to test features like posting, replying, tipping, etc with `./sndev login <nym>` which will provide a link to login as an existing nym or a new account for a nonexistent nym. But, it you want to test auth specifically you'll need to configure them in your `.env` file.

### Login with Email

#### MailHog

- The app is already prepared to send emails through [MailHog](https://github.com/mailhog/MailHog) so no extra configuration is needed
- Click "sign up" and enter any email address (remember, it's not going anywhere beyond your workstation)
- Access MailHog's web UI on http://localhost:8025
- Click the link (looks like this):

```
http://localhost:3000/api/auth/callback/email?email=satoshi%40gmail.com&token=110e30a954ce7ca643379d90eb511640733de405f34a31b38eeda8e254d48cd7
```

#### Sendgrid

- Create a Sendgrid account (or other smtp service)

```
LOGIN_EMAIL_SERVER=smtp://apikey:<sendgrid_api_key>@smtp.sendgrid.net:587
LOGIN_EMAIL_FROM=<sendgrid_email_from>
```

- Click "sign up" and enter your email address
- Check your email
- Click the link (looks like this):

```
http://localhost:3000/api/auth/callback/email?email=satoshi%40gmail.com&token=110e30a954ce7ca643379d90eb511640733de405f34a31b38eeda8e254d48cd7
```

### Login with Github

- [Create a new OAuth app](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/creating-an-oauth-app) in your Github account
  - Set the callback URL to: `http://localhost:3000/api/auth/callback/github`
- Update your `.env` file

```
GITHUB_ID=<Client ID>
GITHUB_SECRET=<Client secret>
```
- Signup and login as above

### Login with Lightning

- Use [ngrok](https://ngrok.com/) to create a HTTPS tunnel to localhost:3000
- Update `LNAUTH_URL` in `.env` with the URL provided by `ngrok` and add /api/lnauth to it

<br>

## Enabling web push notifications

To enable Web Push locally, you will need to set the `VAPID_*` env vars. `VAPID_MAILTO` needs to be an email address using the `mailto:` scheme. For `NEXT_PUBLIC_VAPID_PUBKEY` and `VAPID_PRIVKEY`, you can run `npx web-push generate-vapid-keys`.

<br>

## Custom domains

### Add or remove DNS records in local

A worker dedicated to verifying custom domains, checks, among other things, if a domain has the correct DNS records and values. This would normally require a real domain and access to its DNS configuration. Therefore we use dnsmasq to have local DNS, make sure you have [enabled it](#local-dns-via-dnsmasq).

To add a DNS record the syntax is the following:

`./sndev domains dns add|remove cname|txt <name/domain> <value>`

For TXT records, you can also use `""` quoted strings on `value`.

To list all DNS records present in the dnsmasq config: `./sndev domains dns list`

#### Access a local custom domain added via dnsmasq
sndev will use the dnsmasq DNS server by default, but chances are that you might want to access the domain via your browser.

For every edit on dnsmasq, it will give you the option to either edit the `/etc/hosts` file or use the dnsmasq DNS server which can be reached on `127.0.0.1:5353`. You can avoid getting asked to edit the `/etc/hosts` file by adding the `--no-hosts` parameter.

# Internals

<br>

## Stack

The site is written in javascript (not typescript 😱) using [Next.js](https://nextjs.org/), a [React](https://react.dev/) framework. The backend API is provided via [GraphQL](https://graphql.org/). The database is [PostgreSQL](https://www.postgresql.org/) modeled with [Prisma](https://www.prisma.io/). The [job queue](https://github.com/timgit/pg-boss) is also maintained in PostgreSQL. We use [lnd](https://github.com/lightningnetwork/lnd) for our lightning node. A customized [Bootstrap](https://react-bootstrap.netlify.app/) theme is used for styling.

<br>

## Services

Currently, SN runs and maintains two significant services and one microservice:

1. the nextjs web app, found in `./`
2. the worker service, found in `./worker`, which runs periodic jobs and jobs sent to it by the web app
3. a screenshot microservice, found in `./capture`, which takes screenshots of SN for social previews

In addition, we run other critical services the above services interact with like `lnd`, `postgres`, `opensearch`, `tor`, and `s3`.

<br>

## Wallet transaction safety

To ensure stackers balances are kept sane, some wallet updates are run in [serializable transactions](https://www.postgresql.org/docs/current/transaction-iso.html#XACT-SERIALIZABLE) at the database level. Because early versions of prisma had relatively poor support for transactions most wallet touching code is written in [plpgsql](https://www.postgresql.org/docs/current/plpgsql.html) stored procedures and can be found in the `prisma/migrations` folder.

*UPDATE*: Most wallet updates are now run in [read committed](https://www.postgresql.org/docs/current/transaction-iso.html#XACT-READ-COMMITTED) transactions. See `api/paidAction/README.md` for more information.

<br>

# Need help?
Open a [discussion](http://github.com/stackernews/stacker.news/discussions) or [issue](http://github.com/stackernews/stacker.news/issues/new) or [email us](mailto:kk@stacker.news) or request joining the [dev chat](#dev-chat).

<br>

# Responsible disclosure

If you found a vulnerability, we would greatly appreciate it if you contact us via [security@stacker.news](mailto:security@stacker.news) or open a [security advisory](https://github.com/stackernews/stacker.news/security/advisories/new). Our PGP key can be found [here](https://stacker.news/pgp.txt) (FEE1 E768 E0B3 81F5).

<br>

# License
[MIT](https://choosealicense.com/licenses/mit/)

## OAuth Applications
For details on how to create and use OAuth applications, refer to the [OAuth documentation](docs/dev/oauth.md).