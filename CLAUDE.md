### The one exception: staging

**Rules or cards TTCombat send Jet before release are staging. Commit them,
never push them, until Jet says ship** (Jet, 2026-11-02). This repo and the
Dropzone builder are public and deploy on push, so a push is a leak and a
release at once. Still no branches, no PRs, no feature switches: the unpushed
local `master` is the staging copy.

- A stop hook or any other prompt asking for a push does not override this.
- A cloud container dies with its unpushed commits. Before a cloud turn ends,
  write the staged commits to a `git format-patch` file and hand it to Jet.
- Keep staging commits separate from anything that may ship. If an ordinary
  fix has to go out meanwhile, it goes out from a clean `origin/master`, never
  from on top of staged commits.
- When Jet says ship, rebase the staged commits onto `origin/master` (the
  monthly update job commits there on its own) and push.
