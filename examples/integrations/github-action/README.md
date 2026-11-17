# GitHub Actions: fail a workflow when a token can be rugged

A scheduled check for the tokens your project lists, holds or trades. It fails the job when any of them has a power you did not allow:

- a live **mint authority** (more supply can be printed)
- a live **freeze authority** (holders can be frozen)
- a Token-2022 **permanent delegate**, **transfer fee**, **transfer hook**, **paused** transfers, accounts **frozen by default**, or **non-transferable** tokens

Mutable metadata is reported but does not fail the check.

## Run it locally

```bash
node examples/integrations/github-action/token-check.js DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263 EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v
```

```
PASS  DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263  Bonk (Bonk)  no flagged powers (metadata mutable)
FAIL  EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v  USD Coin (USDC)  mintAuthorityActive, freezeAuthorityActive (metadata mutable)

1 of 2 passed
```

Exit code: `0` all passed, `1` something failed or a mint does not exist, `2` bad usage or the RPC failed.

A stablecoin keeps its authorities on purpose. Accept that with `--allow`:

```bash
node examples/integrations/github-action/token-check.js EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v --allow mintAuthorityActive,freezeAuthorityActive
```

## Use it in a workflow

1. Copy `token-check.js` to `.github/scripts/token-check.js` in your repository.
2. Copy `token-check.yml` to `.github/workflows/token-check.yml` and put your mints in the last step.
3. Optional: add a repository secret `SOLANA_RPC_URL` with a keyed RPC. Without it the free public RPC is used, which serves `getMultipleAccounts` and is fine for a daily run.

Inside Actions the script also writes a pass/fail table to the job summary. The workflow installs the library with `npm install --no-save github:blixvip/solana-token-meta`, so your `package.json` is not touched.

How this was checked: see [VERIFY.md](../../../VERIFY.md#integrations).
