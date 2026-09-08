# Release process

1. Update `CHANGELOG.md` (move Unreleased under the new version).
2. Bump `version` in `package.json` **and** `nodeVersion` in
   `nodes/AutoElevate/AutoElevate.node.json` to the same value.
3. `npm run lint && npm run build && npx n8n-node cloud-support`.
4. Commit, then `npm run release` (release-it: tags, pushes, creates the GitHub release).
5. Publishing the GitHub Release triggers `.github/workflows/release-publish.yml`, which
   validates the tag, checks the codex `nodeVersion`, lints, builds, and publishes to npm with
   provenance via OIDC trusted publishing (`workflow_dispatch` with a tag also works). The first publish of the package must be manual
   (`npm publish --access public`) because npm can only configure a trusted publisher on a
   package that already exists; configure it on npmjs.com afterwards.

The `npm-release-n8n-node` skill in `~/.claude/skills` walks through this.
