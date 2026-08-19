### Proposed changes

Describe the change and the reason for it. If this pull request addresses an issue, link it here with
one of the [supported keywords](https://docs.github.com/en/issues/tracking-your-work-with-issues/using-issues/linking-a-pull-request-to-an-issue)
so it closes on merge - in this description, not in the title.

### Checklist

- [ ] I have read the [`CONTRIBUTING`](CONTRIBUTING.md) document, and [`CLAUDE.md`](CLAUDE.md) for this
      repository's non-obvious rules
- [ ] The title follows Conventional Commits - it becomes the commit subject on `main`, because merging
      is by squash, and release-please parses it for the version and the changelog
- [ ] I have added tests that prove the fix or cover the feature
- [ ] Any reference screenshot I changed was regenerated with `npm run test:update:docker`, never with a
      bare `npm run test:update`
- [ ] I have not silenced a check to make it pass: no `eslint-disable`, no `@ts-ignore`, no type weakened
      to `any`, no skipped test, no lowered coverage threshold
- [ ] I have updated the relevant documentation
