/**
 * Shared shape returned by the auth server actions to their forms. Kept in its
 * own dependency-free module so client form components can import the type
 * without pulling in any server-only code.
 */
export interface AuthActionState {
  /** A user-facing error message to show, or undefined on success. */
  error?: string;
}
