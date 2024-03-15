<p align="center">
<a href="https://stacker.news">
<img height="50" alt="Internet Communities with Bitcoin Economies" src="https://private-user-images.githubusercontent.com/34140557/313019203-bea58059-f850-4d4e-b52d-7e24bc307c8c.png?jwt=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJnaXRodWIuY29tIiwiYXVkIjoicmF3LmdpdGh1YnVzZXJjb250ZW50LmNvbSIsImtleSI6ImtleTUiLCJleHAiOjE3MTA0NTgwNjMsIm5iZiI6MTcxMDQ1Nzc2MywicGF0aCI6Ii8zNDE0MDU1Ny8zMTMwMTkyMDMtYmVhNTgwNTktZjg1MC00ZDRlLWI1MmQtN2UyNGJjMzA3YzhjLnBuZz9YLUFtei1BbGdvcml0aG09QVdTNC1ITUFDLVNIQTI1NiZYLUFtei1DcmVkZW50aWFsPUFLSUFWQ09EWUxTQTUzUFFLNFpBJTJGMjAyNDAzMTQlMkZ1cy1lYXN0LTElMkZzMyUyRmF3czRfcmVxdWVzdCZYLUFtei1EYXRlPTIwMjQwMzE0VDIzMDkyM1omWC1BbXotRXhwaXJlcz0zMDAmWC1BbXotU2lnbmF0dXJlPTE1NWI5YzM4YjA2YjI3Yzc3YzkzNmMwMDMwOWY1MDUwZjk5NTdiYTZjNzEzMDcxZGRmY2FlYzM3ZjFjOGM2M2YmWC1BbXotU2lnbmVkSGVhZGVycz1ob3N0JmFjdG9yX2lkPTAma2V5X2lkPTAmcmVwb19pZD0wIn0.iW6d6aX_GErW7EY81p7PA2iVg9OhvGSoTwJC4VTvrCk">
</a>
</p>

- Stacker News makes Bitcoin economies
- What You See is What We Ship (look ma, I invented an initialism)
- 100% FOSS
- We pay bitcoin for PRs, issues, documentation, code reviews and more
- Next.js, postgres, graphql, and lnd

<br>

# Getting started

Launch a fully featured SN development environment in a single command.

```txt
$ ./sndev start
```

Go to [localhost:3000](http://localhost:3000).

<br>

## Installation

- Clone the repo
   - ssh: `git clone git@github.com:stackernews/stacker.news.git`
   - https: `git clone https://github.com/stackernews/stacker.news.git`
- Install [docker](https://docs.docker.com/get-docker/)

<br>

## Usage

Start the development environment

```txt
$ ./sndev start
```

View all available commands

```txt
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
  help            show help

  env:
    start         start env
    stop          stop env
    restart       restart env
    status        status of env
    delete        delete env

  sn:
    login         login as a nym

  lnd:
    fund          pay a bolt11 for funding
    withdraw      create a bolt11 for withdrawal

  db:
    psql          open psql on db
    prisma        run prisma commands

  github:
    pr            fetch and checkout a pr

  other:
    compose       docker compose passthrough
    sn_lncli      lncli passthrough on sn_lnd
    stacker_lncli lncli passthrough on stacker_lnd

```

<br>

# Table of Contents
- [Getting started](#getting-started)
    - [Installation](#installation)
    - [Usage](#usage)
- [Contributing](#Contributing)
    - [We pay bitcoin for contributions](#we-pay-bitcoin-for-contributions)
    - [Pull request awards](#pull-request-awards)
    - [Code review awards](#code-review-awards)
    - [Issue specification awards](#issue-specification-awards)
    - [Responsible disclosure of security or privacy vulnerability awards](#responsible-disclosure-of-security-or-privacy-vulnerability-awards)
    - [Development documentation awards](#development-documentation-awards)
    - [Helpfulness awards](#helpfulness-awards)
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
	- You are responsible for understanding the issue and requirements before requesting review on a PR.
	- There is no award reduction for asking specific questions on the issue itself or on the PR before requesting review
	- There is no award reduction for asking more general questions in a discussion
4. A PR must be merged by an SN engineer before a PR receives an award

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
| `priority:medium` | 1.5        |
| `priority:high`   | 2          |
| `priority:urgent` | 3          |

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
1. Disclosure is responsible and does not increase the likelihood of an exploit
2. Disclosure details how to exploit the vulnerability with certainty

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

# Need help?
Open a [discussion](http://github.com/stackernews/stacker.news/discussions) or [issue](http://github.com/stackernews/stacker.news/issues/new) or [email us](mailto:kk@stacker.news) or [chat with us on telegram](https://t.me/stackernews).

<br>

# Responsible disclosure

If you found a vulnerability, we would greatly appreciate it if you contact us via [kk@stacker.news](mailto:kk@stacker.news) or t.me/k00bideh.

<br>

# License
[MIT](https://choosealicense.com/licenses/mit/)
