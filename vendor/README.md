# vendor/

Third-party source we have chosen to own as native code. Everything here is copied from a pinned commit, keeps its LICENSE, and is **never edited in place**: our adaptations live in the owning module (`services/*`, `packages/*`).

- Master list of verified repos and modes: `vendor.lock.json` (generated 2026-10-08; see `docs/research/oss-catalog.md`).
- Only entries with `mode: "V"`, `licenseClass: "PERMISSIVE"` and non-empty `paths` are fetched.
- Commands (stdlib Python + git, no install):
  - `bash scripts/vendor.sh list`
  - `bash scripts/vendor.sh sync [slug ...]`
  - `bash scripts/vendor.sh check` (runs in CI: licence present, UPSTREAM.md present, SHA matches the lock, no local edits)
- Each `vendor/<owner-repo>/` contains the copied paths, upstream LICENSE/NOTICE, and `UPSTREAM.md` (repo, SHA, licence, date, content hash).
- To change vendored behaviour: wrap or subclass in our module. To take a new upstream version: bump `sha` in the lock file, run `sync`, re-run tests, update the register.
- Copyleft, unknown-licence and registry-only-licence repos are never vendored (see policy in `docs/compliance/third-party-licenses.md`).
