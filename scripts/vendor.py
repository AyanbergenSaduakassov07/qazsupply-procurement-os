#!/usr/bin/env python3
"""Vendor third-party code as native, licence-tracked source.

Usage:
  scripts/vendor.sh list                 # show mode-V entries and their state
  scripts/vendor.sh sync [slug ...]      # fetch pinned paths into vendor/<slug>/
  scripts/vendor.sh check                # verify licences, UPSTREAM.md and no local edits

Rules (see docs/compliance/third-party-licenses.md):
- only entries with mode V, licenseClass PERMISSIVE and non-empty `paths` are synced
- the pinned `sha` in vendor/vendor.lock.json is checked out; LICENSE/NOTICE files are always copied
- vendored files are never edited; adaptations live in the owning module
Stdlib only. Needs git and network access to github.com.
"""
import hashlib, json, os, shutil, subprocess, sys, tempfile, datetime, fnmatch

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
VENDOR = os.path.join(ROOT, "vendor")
LOCK = os.path.join(VENDOR, "vendor.lock.json")
LICENSE_GLOBS = ["LICENSE*", "LICENCE*", "COPYING*", "NOTICE*", "UNLICENSE*"]

def load():
    with open(LOCK, encoding="utf-8") as f:
        return json.load(f)

def run(*a, cwd=None):
    return subprocess.run(a, cwd=cwd, check=True, capture_output=True, text=True).stdout

def tree_hash(d):
    h = hashlib.sha256()
    for base, _, files in sorted(os.walk(d)):
        for fn in sorted(files):
            if fn == "UPSTREAM.md":
                continue
            p = os.path.join(base, fn)
            h.update(os.path.relpath(p, d).encode())
            with open(p, "rb") as f:
                h.update(f.read())
    return h.hexdigest()

def eligible(e):
    return e["mode"] == "V" and e["licenseClass"] == "PERMISSIVE" and e.get("paths")

def sync(entries):
    for e in entries:
        if not eligible(e):
            why = []
            if e["mode"] != "V": why.append(f"mode={e['mode']}")
            if e["licenseClass"] != "PERMISSIVE": why.append(f"class={e['licenseClass']}")
            if not e.get("paths"): why.append("no paths set")
            print(f"skip {e['slug']}: " + ", ".join(why)); continue
        dest = os.path.join(VENDOR, e["slug"])
        with tempfile.TemporaryDirectory() as tmp:
            run("git", "clone", "--quiet", "--filter=blob:none", "--no-checkout", e["url"], tmp)
            run("git", "-c", "advice.detachedHead=false", "checkout", "--quiet", e["sha"], cwd=tmp)
            files = run("git", "ls-files", cwd=tmp).splitlines()
            lic = [f for f in files if "/" not in f and any(fnmatch.fnmatch(f.upper(), g) for g in LICENSE_GLOBS)]
            if not lic:
                sys.exit(f"ERROR {e['slug']}: no LICENSE/NOTICE file at repo root in {e['sha']}; refusing to vendor")
            if os.path.isdir(dest): shutil.rmtree(dest)
            os.makedirs(dest)
            for rel in lic:
                shutil.copy2(os.path.join(tmp, rel), os.path.join(dest, rel))
            for rel in e["paths"]:
                src = os.path.join(tmp, rel)
                if not os.path.exists(src):
                    sys.exit(f"ERROR {e['slug']}: path not in repo at pinned SHA: {rel}")
                out = os.path.join(dest, rel)
                os.makedirs(os.path.dirname(out), exist_ok=True)
                if os.path.isdir(src): shutil.copytree(src, out)
                else: shutil.copy2(src, out)
        with open(os.path.join(dest, "UPSTREAM.md"), "w", encoding="utf-8") as f:
            f.write(f"# Upstream\n\n- Repo: {e['url']}\n- Pinned SHA: {e['sha']}\n- Licence: {e['license']}\n"
                    f"- Vendored paths: {', '.join(e['paths'])}\n- Fetched: {datetime.date.today().isoformat()}\n"
                    f"- Content hash: {tree_hash(dest)}\n- Local changes: none (do not edit; adapt in the owning module)\n")
        print(f"synced {e['slug']} @ {e['sha'][:10]}")

def check(entries):
    bad = 0
    by = {e["slug"]: e for e in entries}
    for name in sorted(os.listdir(VENDOR)) if os.path.isdir(VENDOR) else []:
        d = os.path.join(VENDOR, name)
        if not os.path.isdir(d): continue
        e = by.get(name)
        if not e: print(f"FAIL {name}: not in lock file"); bad += 1; continue
        if not eligible(e): print(f"FAIL {name}: not eligible for vendoring ({e['mode']}/{e['licenseClass']})"); bad += 1
        up = os.path.join(d, "UPSTREAM.md")
        if not os.path.exists(up): print(f"FAIL {name}: UPSTREAM.md missing"); bad += 1; continue
        if not any(fnmatch.fnmatch(f.upper(), g) for f in os.listdir(d) for g in LICENSE_GLOBS):
            print(f"FAIL {name}: no LICENSE file"); bad += 1
        text = open(up, encoding="utf-8").read()
        rec = [l.split(": ", 1)[1] for l in text.splitlines() if l.startswith("- Content hash: ")]
        if not rec or rec[0] != tree_hash(d): print(f"FAIL {name}: vendored files were edited (hash mismatch)"); bad += 1
        if f"Pinned SHA: {e['sha']}" not in text: print(f"FAIL {name}: pinned SHA differs from lock file; run sync"); bad += 1
    for e in entries:
        if e["mode"] == "V" and e.get("paths") and not os.path.isdir(os.path.join(VENDOR, e["slug"])):
            print(f"FAIL {e['slug']}: has paths but is not vendored; run sync"); bad += 1
    print("vendor check: OK" if not bad else f"vendor check: {bad} problem(s)")
    return 1 if bad else 0

def main():
    cmd = sys.argv[1] if len(sys.argv) > 1 else "list"
    entries = load()["entries"]
    if cmd == "list":
        for e in entries:
            if e["mode"] == "V":
                print(f"{e['slug']:28} {e['licenseClass']:12} paths={len(e.get('paths', []))} phase={e['phase']} {e['license']}")
    elif cmd == "sync":
        want = set(sys.argv[2:]); sync([e for e in entries if not want or e["slug"] in want])
    elif cmd == "check":
        sys.exit(check(entries))
    else:
        print(__doc__); sys.exit(2)

if __name__ == "__main__":
    main()
