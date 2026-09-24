import { type ReactNode, useEffect, useState } from 'react';
import type { SendRequest } from '../../types';
import PageLayout from '../PageLayout';
import '../UserGuide.css';
import '../markdown.css';

interface DisclaimerProps {
  /** REST request function (an extension's `useRemote().sendRequest`). */
  sendRequest: SendRequest;
  /** Link shown when no disclaimer was generated during build (e.g. the DISCLAIMER.md source on GitHub).
   *  When omitted, only a plain "not generated" message is shown. */
  sourceUrl?: string;
}

/**
 * Shared Usage Disclaimer page: the build-generated DISCLAIMER article, read from generic's `/disclaimer`
 * endpoint (the same way About and User Guide read theirs). The endpoint answers with an empty body when
 * nothing was generated, which is how "not generated" is told from "not applicable"; that case points at
 * the online source when `sourceUrl` is given. A failed request (non-OK status, network error) is shown as
 * an error instead.
 */
export default function Disclaimer({ sendRequest, sourceUrl }: Readonly<DisclaimerProps>) {
  const [html, setHtml] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    sendRequest({ method: 'GET', url: '/disclaimer' })
      .then(async (response) => {
        if (cancelled) return;
        // Only an OK empty body means "not generated"; any other status is a real failure (a server error,
        // missing permissions) and is reported as one, like UserGuide does, rather than hidden as absent.
        if (!response.ok) {
          setError(`Failed to load the disclaimer (HTTP ${response.status}).`);
          return;
        }
        const article = (await response.text()).trim();
        // Re-checked after the body is read: an unmount during that await must not set state.
        if (cancelled) return;
        if (article) {
          setHtml(article);
        } else {
          setMissing(true);
        }
      })
      .catch((e) => {
        if (!cancelled) setError(`Failed to load the disclaimer (${(e as Error).message}).`);
      });
    return () => {
      cancelled = true;
    };
  }, [sendRequest]);

  let content: ReactNode;
  if (error) {
    content = <div className="alert alert-error">{error}</div>;
  } else if (missing) {
    content = (
      <p>
        No disclaimer has been generated during build.
        {sourceUrl ? (
          <>
            {' '}
            Please check{' '}
            <a href={sourceUrl} target="_blank" rel="noreferrer">
              the online documentation
            </a>
            {'.'}
          </>
        ) : null}
      </p>
    );
  } else if (html === null) {
    content = <p>Loading...</p>;
  } else {
    // Trusted, build-generated HTML from DISCLAIMER.md; served by /disclaimer.
    content = <article className="markdown-body user-guide-page" dangerouslySetInnerHTML={{ __html: html }} />;
  }

  return <PageLayout title="Usage Disclaimer">{content}</PageLayout>;
}
