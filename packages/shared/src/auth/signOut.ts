export type SignOutAndResetOptions = {
  signOut: () => Promise<void>;
  clearLocalSessionArtifacts?: () => Promise<void>;
  onReset?: () => Promise<void>;
  onNavigate?: () => void | Promise<void>;
};

export async function signOutAndReset({
  signOut,
  clearLocalSessionArtifacts,
  onReset,
  onNavigate,
}: SignOutAndResetOptions) {
  await signOut();

  if (clearLocalSessionArtifacts) {
    await clearLocalSessionArtifacts();
  }

  if (onReset) {
    await onReset();
  }

  if (onNavigate) {
    await onNavigate();
  }
}
