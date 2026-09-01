# Releasing

Releases are automated by [release-please](https://github.com/googleapis/release-please). Nobody edits
a version number by hand, and nobody publishes from a workstation.

## How it works

1. **Every merge to `main` updates a release pull request.** The `release-please` workflow reads the
   Conventional Commit subjects since the last tag, works out the next semantic version, and maintains
   a single open pull request titled `chore(main): release <version>` that bumps `package.json` and
   writes the [`CHANGELOG.md`](./CHANGELOG.md) entry.

   This is why the commit conventions in [`CONTRIBUTING.md`](./CONTRIBUTING.md) matter: a subject
   release-please cannot parse contributes nothing to the version and never appears in the changelog.

2. **Merging that pull request performs the release.** release-please creates the tag (`v<version>`)
   and the GitHub release from the merge commit through the API. The version bump arrives as a pull
   request precisely so that the required `ci` check is satisfied the normal way and nothing pushes to
   the protected branch.

3. **The test suite runs again on the merge commit**, in the same pinned Playwright image CI uses, so
   the tarball is never published from a tree that was not tested.

4. **The package is published to npm** as
   [`@sbb-polarion/react-sbb-polarion`](https://www.npmjs.com/package/@sbb-polarion/react-sbb-polarion),
   and the tarball is also attached to the GitHub release for the consumers that were pinned to a
   release asset before the package was on the registry.

## Publishing credentials

There are none. npm trusts this repository's release workflow through
[trusted publishing](https://docs.npmjs.com/trusted-publishers), so `npm publish` authenticates with the
workflow's OIDC identity, which is also what produces the provenance attestation on every release.

Two consequences worth knowing before changing anything in that area:

- **The trust is bound to the repository and to the workflow file name.** Renaming
  `.github/workflows/release-please.yml`, or moving the repository, breaks publishing - and it breaks it
  silently, because nothing fails until the next release. Re-bind it in the same change:

  ```shell
  npm trust github @sbb-polarion/react-sbb-polarion --file release-please.yml \
    --repo SchweizerischeBundesbahnen/react-sbb-polarion --allow-publish
  ```

- **The publish job cannot move into a shared reusable workflow.** npm matches the trusted publisher
  against the workflow that presents the OIDC token, and a job delegated elsewhere presents that
  workflow's identity instead of this repository's.

A token is not an alternative: the account requires two-factor authentication for writes, so a
token-based publish fails on `EOTP`.

## Version policy

Semantic versioning, derived from the commit types:

| Commit | Effect |
| --- | --- |
| `fix:` | patch |
| `feat:` | minor |
| any type with `!`, or a `BREAKING CHANGE:` footer | major |
| `chore:`, `ci:`, `docs:`, `test:`, `refactor:`, `style:`, `build:` | no release on their own |

`react` and `react-dom` are peer dependencies. Widening the supported peer range is a `feat`; narrowing
it is a breaking change, because it removes support a consumer may be relying on.

Dependency updates count. Renovate types every dependency bump `fix` through the shared preset, so a
Renovate merge produces a patch release on its own - and because this package declares one runtime
dependency and everything else as a devDependency, most of those releases are tooling bumps that leave
`dist/` unchanged. Workflow actions, pre-commit hooks and lock-file maintenance are typed `chore` and
do not release.

## There is no long-term support branch

Unlike the Java extensions in this organisation, this package releases from `main` only. Fixes go into
the next version; there is no `release-v*` branch to backport to.
