import { type ReactNode, createElement } from 'react';

/**
 * The tags the details of a configuration status may use. The status providers of the extensions write their details
 * as HTML for the generic `about.jsp`: a colored span around a warning, a link to a release.
 */
const ALLOWED_TAGS = new Set(['a', 'b', 'br', 'code', 'em', 'i', 'span', 'strong']);

/** Tags whose content is no text to read: they are left out with it. */
const DROPPED_TAGS = new Set(['script', 'style', 'template', 'noscript', 'iframe', 'object', 'embed']);

/** The addresses a link in the details may lead to. */
const LINK_PROTOCOLS = new Set(['http:', 'https:', 'mailto:']);

/**
 * The details of a configuration status, as the legacy page showed them. They hold what a service answered, such as a
 * version or the message of an error, so they are not set as HTML: they are parsed, and only the allowed tags become
 * elements, with no attribute but the color of a span and the address of a link. Any other tag gives its text alone.
 */
export default function StatusDetails({ html }: Readonly<{ html: string }>) {
  const body = new DOMParser().parseFromString(html, 'text/html').body;
  return <>{toNodes(body.childNodes)}</>;
}

function toNodes(nodes: NodeListOf<ChildNode>): ReactNode[] {
  return Array.from(nodes).map((node, index) => toNode(node, index));
}

function toNode(node: ChildNode, key: number): ReactNode {
  if (node.nodeType === Node.TEXT_NODE) {
    return node.textContent;
  }
  if (!(node instanceof HTMLElement)) {
    return null;
  }
  const tag = node.tagName.toLowerCase();
  if (DROPPED_TAGS.has(tag)) {
    return null;
  }
  const children = toNodes(node.childNodes);
  if (!ALLOWED_TAGS.has(tag)) {
    return createElement('span', { key }, ...children);
  }
  if (tag === 'br') {
    return <br key={key} />;
  }
  if (tag === 'span') {
    const color = node.style.color;
    return createElement('span', { key, style: color ? { color } : undefined }, ...children);
  }
  if (tag === 'a') {
    const href = linkAddress(node.getAttribute('href'));
    return href
      ? createElement('a', { key, href, target: '_blank', rel: 'noreferrer' }, ...children)
      : createElement('span', { key }, ...children);
  }
  return createElement(tag, { key }, ...children);
}

/** The address of a link, when it leads to a web page or a mail. */
function linkAddress(href: string | null): string | null {
  if (!href) {
    return null;
  }
  try {
    return LINK_PROTOCOLS.has(new URL(href).protocol) ? href : null;
  } catch {
    return null;
  }
}
