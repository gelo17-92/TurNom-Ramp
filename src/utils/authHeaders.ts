import { auth } from '../firebase';

/**
 * Builds request headers attaching the current Firebase ID Token when authenticated.
 */
export async function getAuthHeaders(
  extra: Record<string, string> = {}
): Promise<Record<string, string>> {
  const headers: Record<string, string> = { ...extra };
  try {
    if (auth.currentUser) {
      const token = await auth.currentUser.getIdToken();
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }
    }
  } catch {
    // Allow unauthenticated fallback when token cannot be retrieved
  }
  return headers;
}
