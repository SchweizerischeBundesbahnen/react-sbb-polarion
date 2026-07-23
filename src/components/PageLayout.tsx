import type { ReactNode } from 'react';
import { isEmbedded } from '../services/params';
import { getScope } from '../services/scope';
import './PageLayout.css';

interface PageLayoutProps {
  title?: string;
  children: ReactNode;
}

/**
 * Shared frame for a feature page: an optional title plus an optional "back to overview" link. The link
 * is shown by default (dev navigation from the Landing stub) and hidden only when `?embedded=true` - the
 * mode hivemodule.xml uses so the user cannot leave the page Polarion opened. It is a plain relative link
 * so it behaves the same in `vite dev` and under the Polarion servlet.
 *
 * `title` renders the standard admin-page `<h1>` heading (with its underline). Pass it for admin pages
 * (About, settings pages, ...); omit it for a primary product surface that should carry the Overview
 * back link but not an admin heading.
 */
export default function PageLayout({ title, children }: PageLayoutProps) {
  // Carry the current scope back to the Overview landing so navigating back and into another feature
  // keeps the project scope (dev navigation only; in Polarion the page is embedded and this is hidden).
  const scope = getScope();
  const overviewHref = scope ? `?scope=${encodeURIComponent(scope)}` : '?';
  return (
    <div className="page">
      {!isEmbedded() && (
        <nav className="page-nav">
          <a href={overviewHref}>&larr; Overview</a>
        </nav>
      )}
      {title && <h1>{title}</h1>}
      <div className="page-body">{children}</div>
    </div>
  );
}
