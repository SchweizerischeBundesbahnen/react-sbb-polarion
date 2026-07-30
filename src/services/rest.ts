/**
 * Shared response handling for the service builders in this folder. Every generic REST endpoint
 * answers the same way - a JSON body on success, a `{message}` or `{errorMessage}` envelope on
 * failure - so the unwrapping lives here rather than once per service.
 *
 * Internal: not re-exported from the package entry point. A consuming extension gets these behaviors
 * through the service it is handed (`createAuthorizationService`, `createStylePackageWeightsService`).
 */

/** Extracts a human-readable message from a failed response. */
export async function errorMessage(response: Response): Promise<string> {
  const text = await response.text().catch(() => '');
  if (text) {
    try {
      const parsed = JSON.parse(text) as { message?: string; errorMessage?: string };
      if (parsed?.message) return parsed.message;
      if (parsed?.errorMessage) return parsed.errorMessage;
    } catch {
      return text;
    }
  }
  return `HTTP ${response.status}`;
}

export async function jsonOrThrow<T>(response: Response): Promise<T> {
  if (!response.ok) {
    throw new Error(await errorMessage(response));
  }
  return (await response.json()) as T;
}

export async function okOrThrow(response: Response): Promise<void> {
  if (!response.ok) {
    throw new Error(await errorMessage(response));
  }
}
