import { type ReactNode, useEffect, useRef, useState } from 'react';
import { getScope } from '../services/scope';
import type { ConfigurationPropertiesModel, ConfigurationStatus, SendRequest, Version } from '../types';
import './About.css';
import PageLayout from './PageLayout';
import RestAuthTest from './RestAuthTest';
import './markdown.css';

const STATUS_COLORS: Record<ConfigurationStatus['status'], string> = {
  OK: 'green',
  WARNING: 'orange',
  ERROR: 'red',
};

interface AboutProps {
  /** REST request function (an extension's `useRemote().sendRequest`). */
  sendRequest: SendRequest;
  /** The extension's app icon (a bundled/imported asset URL), shown top-right. */
  appIcon: string;
  /** Full URL the debug-only RestAuthTest calls, e.g. `/polarion/<extension>/rest/api/version`. */
  restApiUrl: string;
}

interface AboutData {
  version: Version;
  config: ConfigurationPropertiesModel;
  statuses: ConfigurationStatus[];
  documentation: string;
}

/** Manifest entries shown in the "Extension info" table, in the order the legacy JSP used. The
 * support email, when present, is rendered as a mailto link. */
function versionRows(version: Version): Array<{ label: string; value: string; email?: boolean }> {
  const rows: Array<{ label: string; value: string; email?: boolean }> = [
    { label: 'Bundle-Name', value: version.bundleName ?? '' },
    { label: 'Bundle-Vendor', value: version.bundleVendor ?? '' },
  ];
  if (version.supportEmail) {
    rows.push({ label: 'Support-Email', value: version.supportEmail, email: true });
  }
  rows.push(
    { label: 'Automatic-Module-Name', value: version.automaticModuleName ?? '' },
    { label: 'Bundle-Version', value: version.bundleVersion ?? '' },
    { label: 'Bundle-Build-Timestamp', value: version.bundleBuildTimestamp ?? '' },
  );
  return rows;
}

/**
 * Shared extension About page (the React equivalent of the generic server-rendered
 * `common/jsp/about.jsp`). Fetches and renders the extension info (/version), configuration
 * properties, configuration status and the build-generated README help article, plus the debug-only
 * REST auth test. The per-extension bits are injected: the REST request function, the app icon and
 * the RestAuthTest URL. The endpoints themselves are the generic ones, identical for every extension.
 */
export default function About({ sendRequest, appIcon, restApiUrl }: Readonly<AboutProps>) {
  const scope = getScope();

  const [data, setData] = useState<AboutData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [versionRes, configRes, statusRes, docRes] = await Promise.all([
          sendRequest({ method: 'GET', url: '/version' }),
          sendRequest({ method: 'GET', url: '/configuration-properties' }),
          sendRequest({ method: 'GET', url: `/configuration-status?scope=${encodeURIComponent(scope)}` }),
          sendRequest({ method: 'GET', url: '/readme' }),
        ]);
        if (cancelled) return;
        if (!versionRes.ok || !configRes.ok || !statusRes.ok) {
          const failing = [versionRes, configRes, statusRes].find((r) => !r.ok);
          const body = await failing?.json().catch(() => null);
          const detail = body?.errorMessage || body?.message || `HTTP ${failing?.status}`;
          setError(`Failed to load About information (${detail}).`);
          return;
        }
        const version: Version = await versionRes.json();
        const config: ConfigurationPropertiesModel = await configRes.json();
        const statuses: ConfigurationStatus[] = await statusRes.json();
        // The help article is optional; a non-OK response just leaves it blank.
        const documentation = docRes.ok ? await docRes.text() : '';
        if (cancelled) return;
        setData({ version, config, statuses, documentation });
      } catch (e) {
        if (cancelled) return;
        setError(`Failed to load About information (${(e as Error).message}).`);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sendRequest, scope]);

  // Same-page anchor links (property descriptions and the README article cross-references, e.g.
  // `#strictdoc-configuration`) otherwise resolve against this page's URL, so the browser hover
  // preview leaks the embedded query string (?feature=…&embedded=true&scope=…). Turn them into
  // in-page scroll targets with just the fragment as their tooltip - no resolved URL is exposed.
  useEffect(() => {
    const root = pageRef.current;
    if (!root) return;
    root.querySelectorAll<HTMLAnchorElement>('a[href^="#"]').forEach((a) => {
      const href = a.getAttribute('href') ?? '';
      const id = decodeURIComponent(href.slice(1));
      a.removeAttribute('href'); // drop the resolvable URL so the hover preview stays clean
      a.title = href;
      a.setAttribute('role', 'link');
      a.tabIndex = 0;
      a.classList.add('about-anchor');
      const scrollToTarget = () => {
        if (id) document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
      };
      a.addEventListener('click', scrollToTarget);
      a.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          scrollToTarget();
        }
      });
    });
  }, [data]);

  // Three states read better as a sequence than as a nested ternary in the JSX.
  let content: ReactNode;
  if (error) {
    content = <div className="alert alert-error">{error}</div>;
  } else if (!data) {
    content = <p>Loading...</p>;
  } else {
    content = (
      <div className="about-page" ref={pageRef}>
        <div className="about-header">
          <h3>Extension info</h3>
          <img className="app-icon" src={appIcon} alt="" />
        </div>
        <div className="about-table-wrap">
          <table className="about-table">
            <thead>
              <tr>
                <th>Manifest entry</th>
                <th>Value</th>
              </tr>
            </thead>
            <tbody>
              {versionRows(data.version).map((row) => (
                <tr key={row.label}>
                  <td>{row.label}</td>
                  <td>
                    {row.email ? (
                      <a target="_blank" rel="noreferrer" href={`mailto:${row.value}`}>
                        {row.value}
                      </a>
                    ) : (
                      row.value
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Debug-only manual REST token auth test (ported from the generic about.jsp). */}
        {data.config.properties.some((p) => p.key.endsWith('.debug') && p.value === 'true') && (
          <RestAuthTest restApiUrl={restApiUrl} />
        )}

        <h3>Extension configuration properties</h3>
        <div className="about-table-wrap">
          <table className="about-table">
            <thead>
              <tr>
                <th>Configuration property</th>
                <th>Value</th>
                <th>Default</th>
                <th>Description</th>
              </tr>
            </thead>
            <tbody>
              {data.config.properties.map((prop) => (
                <tr key={prop.key}>
                  <td>{prop.key}</td>
                  <td>{prop.value}</td>
                  <td>{prop.defaultValue ?? ''}</td>
                  {/* Descriptions are trusted server-authored HTML (they may contain links into the
                        README anchors below, e.g. #strictdoc-configuration), same as the legacy JSP. */}
                  <td className="about-description" dangerouslySetInnerHTML={{ __html: prop.description ?? '' }} />
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {data.config.obsoleteProperties.length > 0 && (
          <>
            <h3>Obsolete/non-valid configuration properties</h3>
            <div className="about-table-wrap">
              <table className="about-table">
                <thead>
                  <tr>
                    <th>Configuration property</th>
                    <th>Value</th>
                  </tr>
                </thead>
                <tbody>
                  {data.config.obsoleteProperties.map((prop) => (
                    <tr key={prop.key}>
                      <td>{prop.key}</td>
                      <td>{prop.value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {data.statuses.length > 0 && (
          <>
            <h3>Extension configuration status</h3>
            <div className="about-table-wrap">
              <table className="about-table">
                <thead>
                  <tr>
                    <th>Configuration</th>
                    <th>Status</th>
                    <th>Info</th>
                  </tr>
                </thead>
                <tbody>
                  {data.statuses.map((status) => (
                    <tr key={status.name}>
                      <td>{status.name}</td>
                      <td style={{ color: STATUS_COLORS[status.status] }}>{status.status}</td>
                      <td>{status.details}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {data.documentation && (
          // Trusted, build-generated HTML from the extension's README; served by /readme.
          <article className="markdown-body" dangerouslySetInnerHTML={{ __html: data.documentation }} />
        )}
      </div>
    );
  }

  return <PageLayout title="About">{content}</PageLayout>;
}
