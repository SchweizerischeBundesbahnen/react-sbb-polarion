import { type ReactNode, useEffect, useState } from 'react';
import type { SendRequest } from '../types';
import PageLayout from './PageLayout';
import './UserGuide.css';
import './markdown.css';

interface UserGuideProps {
  /** REST request function (an extension's `useRemote().sendRequest`). */
  sendRequest: SendRequest;
}

/**
 * Shared User Guide page. Like the About page's help article, it renders the build-generated help
 * HTML (from USER_GUIDE.md) served by the generic `/user-guide` endpoint. The base markdown styling
 * comes from the generic `github-markdown-light.css` the consuming app links in its index.html; the
 * heading look comes from the bundled markdown.css.
 */
export default function UserGuide({ sendRequest }: Readonly<UserGuideProps>) {
  const [html, setHtml] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    sendRequest({ method: 'GET', url: '/user-guide' })
      .then(async (response) => {
        if (cancelled) return;
        if (!response.ok) {
          setError(`Failed to load the user guide (HTTP ${response.status}).`);
          return;
        }
        setHtml(await response.text());
      })
      .catch((e) => {
        if (!cancelled) setError(`Failed to load the user guide (${(e as Error).message}).`);
      });
    return () => {
      cancelled = true;
    };
  }, [sendRequest]);

  // Three states read better as a sequence than as a nested ternary in the JSX.
  let content: ReactNode;
  if (error) {
    content = <div className="alert alert-error">{error}</div>;
  } else if (html === null) {
    content = <p>Loading...</p>;
  } else {
    // Trusted, build-generated HTML from USER_GUIDE.md; served by /user-guide.
    content = <article className="markdown-body user-guide-page" dangerouslySetInnerHTML={{ __html: html }} />;
  }

  return <PageLayout title="User Guide">{content}</PageLayout>;
}
