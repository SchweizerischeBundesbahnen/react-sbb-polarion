# Contributing

Contributions of every kind are welcome. What follows are guidelines rather than rules; use your
judgement, and feel free to propose changes to this document in a pull request.

## Prerequisites

This project and everyone participating in it are governed by the organisation's
[Code of Conduct](https://github.com/SchweizerischeBundesbahnen/.github/blob/main/CODE_OF_CONDUCT.md).
By participating, you are expected to uphold it.

This is a React component library for the Polarion extension admin applications. Working on the
components themselves does not require a Polarion installation, because the whole suite runs in a real
browser under Vitest. Seeing a component in its actual context does.

## Where the documentation lives

There is deliberately one place for each thing, so that nothing has to be kept in step with a copy:

| Question | Where the answer is |
| --- | --- |
| How do I build, format, lint and publish this? | [`README.md`](./README.md) |
| How do I run the tests, and how do I regenerate a reference screenshot? | [`test/README.md`](./test/README.md) |
| What are the non-obvious rules and traps of this repository? | [`CLAUDE.md`](./CLAUDE.md) |
| What commands exist? | [`package.json`](./package.json) |

`CLAUDE.md` is named for the agent that reads it automatically, but it is written for anyone working
here. It is the single source for the cases where every check stays green and the product is still
broken - the vendored `src/generic` directory and the local patches it carries, the rule that a
reference screenshot is only canonical when regenerated inside the pinned Playwright image, and the
packaging constraints on `react` and `react-dom`. Read it before your first change.

## Asking questions

Open an [issue](../../issues/new/choose) and label it `question`.

## Reporting a bug

[Open a bug report](../../issues/new?template=bug_report.yml). Please check first that it has not
already been reported.

**If the bug is a potential security vulnerability, do not open a public issue.** Follow the
organisation's [security policy](https://github.com/SchweizerischeBundesbahnen/.github/blob/main/SECURITY.md)
instead.

A report is far more likely to be acted on quickly when it says:

- What you expected and what happened instead.
- The version of this package, and the versions of React and of the consuming application.
- The browser, since a component's behaviour can differ between them.
- An unambiguous set of steps, or a minimal reproduction.
- A screenshot, where the problem is visual.

## Suggesting an enhancement

[Open a feature request](../../issues/new?template=feature_request.yml). For a substantial feature,
please open the issue and outline the proposal before writing the code, so that the design can be
discussed and duplicated effort avoided. A small, self-contained improvement can go straight to a pull
request.

## Submitting changes

1. Create a branch from `main`.
2. Make the change, **with tests**. A component change needs behaviour tests; a visual change needs its
   reference screenshot regenerated in the pinned Docker image, never on your own machine - see
   [`test/README.md`](./test/README.md).
3. Run the checks locally. Installing the hooks with `pre-commit install` runs the relevant ones on
   every commit, which is the least effort way to keep them passing.
4. Commit with a **signed** commit. Signed commits are required on every branch by an organisation
   ruleset, and signing is how you certify the [Developer Certificate of Origin](./DCO):

   ```shell
   git commit --gpg-sign
   ```

5. Push your branch and open a pull request against `main`.

Merging is by squash, so the **pull-request title becomes the commit subject on `main`** and must
follow the commit conventions below just as the individual commits do.

## Commit conventions

Commit subjects and pull-request titles follow
[Conventional Commits](https://www.conventionalcommits.org/): `type: subject`, in English, with **no
scope**. Use the imperative mood, a lowercase first letter, no trailing period, and at most 50
characters.

```
feat: add a disabled state to SearchableSelect
fix: keep the dropdown portal inside the shadow root
```

This is not a matter of taste. [release-please](https://github.com/googleapis/release-please) derives
the next version and the changelog from these subjects, so a subject it cannot parse is silently left
out of the release notes. Both the `commitizen` pre-commit hook and the `PR checks` workflow verify it.

## Coding rules

- Every feature and every bug fix **must be covered by tests**. The coverage floor is enforced in CI
  and is a regression guard, not a target - passing it is not evidence that new code arrived with its
  tests.
- Every exported component and hook **must be documented**, so that a consumer can use it from the type
  declarations alone.
- **Never silence a check to make it pass.** No `eslint-disable`, no `@ts-ignore`, no type weakened to
  `any`, no skipped test, no overwritten reference screenshot, no lowered coverage threshold. Fix the
  cause, or ask in the issue or pull request.
- `src/generic/**` is a vendored copy and is never hand-edited. See [`CLAUDE.md`](./CLAUDE.md).

## Releases

Releases are automated. See [`RELEASE.md`](./RELEASE.md).
