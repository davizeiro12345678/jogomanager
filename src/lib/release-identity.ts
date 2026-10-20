/** Bind a release to the checked-out Git commit, never an arbitrary runtime label. */
export function resolveBuildCommit(
  requestedCommit: string | undefined,
  gitCommit: string | null,
  dirtyCheckout = false,
): string | null {
  const fullSha = /^[a-f0-9]{40}$/;
  if (requestedCommit !== undefined && !fullSha.test(requestedCommit)) {
    throw new Error("PFM_BUILD_SHA must be a full 40-character lowercase Git commit SHA.");
  }
  if (gitCommit !== null && !fullSha.test(gitCommit)) {
    throw new Error("The checkout must identify a full 40-character lowercase Git commit SHA.");
  }
  if (requestedCommit !== undefined && gitCommit !== null && requestedCommit !== gitCommit) {
    throw new Error("PFM_BUILD_SHA does not match the checkout; refusing to mislabel the release.");
  }
  if (dirtyCheckout) {
    if (requestedCommit !== undefined) {
      throw new Error("Cannot publish a release identity from uncommitted source changes.");
    }
    return null;
  }
  return gitCommit ?? requestedCommit ?? null;
}
