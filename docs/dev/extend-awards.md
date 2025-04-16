# Automatically extend awards.csv

## Overview

Whenever a pull request (PR) is merged in the [stacker.news](https://github.com/stackernews/stacker.news) repository, a [GitHub Action](https://docs.github.com/en/actions) is triggered:

If the merged PR solves an issue with [award tags](https://github.com/stackernews/stacker.news?tab=readme-ov-file#contributing),
the amounts due to the PR and issue authors are calculated and corresponding lines are added to the [awards.csv](https://github.com/stackernews/stacker.news/blob/master/awards.csv) file,
and a PR is opened for this change.

## Action

The action is defined in [.github/workflows/extend-awards.yml](.github/workflows/extend-awards.yml).

Filters on the event type and parameters ensure the action is [triggered only on merged PRs](https://stackoverflow.com/questions/60710209/trigger-github-actions-only-when-pr-is-merged).

The primary job consists of several steps:
  - [checkout](https://github.com/actions/checkout) checks out the repository
  - [setup-python](https://github.com/actions/setup-python) installs [Python](https://en.wikipedia.org/wiki/Python_(programming_language))
  - [pip](https://en.wikipedia.org/wiki/Pip_%28package_manager%29) installs the [requests](https://docs.python-requests.org/en/latest/index.html) module
  - a script (see below) is executed, which appends lines to [awards.csv](awards.csv) if needed
  - [create-pull-request](https://github.com/peter-evans/create-pull-request) looks for modified files and creates (or updates) a PR

### Branch Existence Check

The workflow includes functionality to check if the branch `extend-awards/patch` already exists. This ensures that if a PR is already open for extending `awards.csv`, the workflow will add a commit to the existing branch instead of creating a new PR. The steps are as follows:

1. **Check if the branch exists**:
   - The workflow fetches the branch `extend-awards/patch` from the remote repository.
   - If the branch exists, an environment variable `exists=true` is set; otherwise, `exists=false`.

2. **Handle existing branch**:
   - If the branch exists (`exists=true`), the workflow checks out the branch, configures the Github bot user, and commits the changes directly to the branch.
   - If the branch does not exist (`exists=false`), the workflow creates a new branch and opens a new PR using the `create-pull-request` action.

This ensures that changes are consolidated into a single PR when possible. 

## Script

The script is [extend-awards.py](extend-awards.py).

The script extracts from the [environment](https://en.wikipedia.org/wiki/Environment_variable) an authentication token needed for the [GitHub REST API](https://docs.github.com/en/rest/about-the-rest-api/about-the-rest-api) and the [context](https://docs.github.com/en/actions/writing-workflows/choosing-what-your-workflow-does/accessing-contextual-information-about-workflow-runs) containing the event details including the merged PR (formatted in [JSON](https://en.wikipedia.org/wiki/JSON)).

In the merged PR's title and body it searches for the first [GitHub issue URL](https://github.com/stackernews/stacker.news/issues/) or any number with a hash symbol (#) prefix, and takes this as the issue being solved by the PR.

Using the GitHub REST API it fetches the issue and analyzes its tags for difficulty and priority.

It fetches the issue's timeline and counts the number of reviews completed with status 'changes requested' to calculate the amount reduction.

It calculates the amounts due to the PR author and the issue author.

It reads the existing awards.csv file to suppress appending redundant lines (same user, PR, and issue) and fill known receive methods (same user).

Finally, it appends zero, one, or two lines to the awards.csv file.

## Diagnostics

In the GitHub web interface under 'Actions' each invocation of the action can be viewed, including environment and [output and errors](https://en.wikipedia.org/wiki/Standard_streams) of the script. First, the specific invocation is selected, then the job 'if_merged', then the step 'Run python extend-awards.py'. The environment is found by expanding the inner 'Run python extended-awards.py' on the first line.

The normal output includes details about the issue number found, the amount calculation, or the reason for not appending lines.

The error output may include a [Python traceback](https://realpython.com/python-traceback/) which helps to explain the error.

The environment contains in GITHUB_CONTEXT the event details, which may be required to understand the error.

## Security considerations

The create-pull-request step requires [workflow permissions](https://github.com/peter-evans/create-pull-request#workflow-permissions).
