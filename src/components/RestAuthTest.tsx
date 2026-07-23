import { useState } from 'react';
import './RestAuthTest.css';

interface RestAuthTestProps {
  /** Full URL to GET with the token, e.g. `/polarion/<extension>/rest/api/version`. */
  restApiUrl: string;
}

interface Result {
  text: string;
  success: boolean;
}

/**
 * Manual X-Polarion-REST-Token authentication test (ported from the generic `rest-auth-test.jsp`,
 * typically shown on an extension's About page only when its debug mode is on). Grabs the current
 * session's token via the Polarion shell's `top.getRestApiToken()`, sends it as the
 * `X-Polarion-REST-Token` header to the given `restApiUrl` (an extension's `.../rest/api/version`),
 * and shows the raw HTTP status + body so an admin can confirm in-session REST auth works. Requires
 * `com.siemens.polarion.rest.security.restApiToken.enabled=true`.
 */
export default function RestAuthTest({ restApiUrl }: RestAuthTestProps) {
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);

  const runTest = async () => {
    let token: string | undefined;
    try {
      // top.getRestApiToken() is injected by the Polarion shell window; absent when the app runs
      // standalone (e.g. `vite dev`), where this branch reports it gracefully.
      token = (window.top as unknown as { getRestApiToken?: () => string })?.getRestApiToken?.();
    } catch (e) {
      setResult({ text: `Unable to obtain a token via top.getRestApiToken(): ${e}`, success: false });
      return;
    }
    if (!token) {
      setResult({
        text: 'top.getRestApiToken() returned no token. Make sure the REST API token is enabled and you are logged in.',
        success: false,
      });
      return;
    }

    setBusy(true);
    setResult({ text: `Calling ${restApiUrl} …`, success: true });
    try {
      const response = await fetch(restApiUrl, {
        method: 'GET',
        headers: { Accept: 'application/json', 'X-Polarion-REST-Token': token },
      });
      const body = await response.text();
      let formattedBody = body;
      try {
        formattedBody = JSON.stringify(JSON.parse(body), null, 2);
      } catch {
        // Response is not JSON; show it as-is.
      }
      const statusText =
        response.statusText && response.statusText !== String(response.status) ? ` ${response.statusText}` : '';
      setResult({ text: `HTTP ${response.status}${statusText}\n\n${formattedBody}`, success: response.ok });
    } catch (e) {
      setResult({ text: `Request failed: ${e}`, success: false });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <h3>REST API authentication test</h3>
      <p>
        Sends <code>GET {restApiUrl}</code> with the current session&apos;s <code>X-Polarion-REST-Token</code> header,
        obtained via <code>top.getRestApiToken()</code>. Use it to verify that in-session REST authentication works. The
        token requires <code>com.siemens.polarion.rest.security.restApiToken.enabled=true</code> in{' '}
        <code>polarion.properties</code>.
      </p>
      <button type="button" className="sbb-btn sbb-btn--action" disabled={busy} onClick={runTest}>
        Test REST authentication
      </button>
      {result && <pre className={`rest-auth-test-output ${result.success ? 'success' : 'failure'}`}>{result.text}</pre>}
    </>
  );
}
