# Public-repo readiness (not published)

Status as of Tuesday 17 November 2026, 11:41 UK (Europe/London). **No GitHub repository was created. Nothing was pushed.**

## Secrets scan

Tools: gitleaks 8.28.0 and trufflehog 3.90.8, plus a targeted `rg` / `git grep` pass. Findings below are redacted; no key material is written here.

### Working tree (`steward/` plus the parent `base-stocks/` folder, excluding `node_modules`, `artifacts`, `cache`, `.secrets`)

- **gitleaks dir:** no leaks.
- **rg** for PEM private keys, mnemonic / seed-phrase language, `api_key` / `private_key` assignments, `sk_live_`, `ghp_`, `AKIA…`: no hits.
- **0x + 64 hex:** only `test/fixtures/dexscreener-basket.json` (a committed live DexScreener response). Those values are public pair / tx / token hex in a fixture, not a wallet key.

### Full git history (8 commits on `main`, no remotes)

- **gitleaks git:** 8 commits scanned, **no leaks**.
- **trufflehog git** (`--no-verification`): 0 verified secrets. 23 unverified “Github” hits, all in `test/fixtures/dexscreener-basket.json` at commit `bab0bed`. Each match is a 40-character hex string (Ethereum-style), with no `ghp_` / `github_pat` prefix. Treated as **false positives** on the public DexScreener fixture.
- `git log` for `*.key`, `*.pem`, `.env`, `.secrets/*`, `secrets/*`: **no such file was ever committed**.
- The testnet deployer **address** is documented in `CORE.md` and `STATUS.md` (`0xbad2aA8FFF3d577b08Ef9f128d45C1A807497e4F`). The key file itself lives outside git at `/workspace/money/hackathons/base-stocks/.secrets/sepolia-deployer.key` (mode 600). Parent and repo `.gitignore` exclude `.secrets/`, `secrets/`, and `*.key`.

**No history rewrite is required.** A cleaned orphan copy was not built, because nothing sensitive is in history.

If a secret is added later, a cleaned export can be made with:

```bash
# Example only — not run. Produces a fresh tree without rewriting the working repo.
git checkout --orphan publish-clean
# or: git filter-repo / a filtered clone in a separate directory
```

## Publish branch (local only)

GitHub’s `workflow` scope is missing on the token that would push, so **`.github/workflows/ci.yml` must not be pushed**.

- `main` may contain `.github/workflows/ci.yml` (local CI definition).
- A local branch named **`publish`** is created from `main` with that workflow file **removed**, so a future `git push` of `publish` will not upload workflows.
- Do not `git remote add` and do not push until Ali confirms.

## README

The root `README.md` is the judge-facing page: what Steward is, how to run the guided demo, that the local chain id is 84532, and that no public deploy has happened yet (pointer to `docs/DEPLOYMENTS.md`). Official Rules do not require an AI-assistance disclosure, so none is added as a mandatory statement.
