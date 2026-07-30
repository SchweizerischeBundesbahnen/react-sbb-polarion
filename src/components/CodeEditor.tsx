import { useMemo, useRef } from 'react';
import type { ChangeEvent, ReactNode, UIEvent } from 'react';
import type { Element, RootContent } from 'hast';
import { refractor } from 'refractor/core';
import css from 'refractor/css';
import markup from 'refractor/markup';
import properties from 'refractor/properties';
import velocity from 'refractor/velocity';
import './CodeEditor.css';

/**
 * The languages the editor can highlight, named as the consuming page thinks of its content.
 *
 * `velocity` is Apache Velocity **inside markup** - that is what the grammar is (`markup` extended
 * with directives, variables and `#* *#` comments), and it is what the exporters' templates are: a
 * cover page or a header cell is HTML with `$variables` in it. A pure-Velocity mode (tags left as
 * plain text) would need a grammar derived by hand and no page wants one, so there is deliberately no
 * separate `html+velocity` value - `velocity` already covers both.
 */
export type CodeLanguage = 'css' | 'html' | 'properties' | 'velocity';

// Registering `velocity` also registers `markup` (its grammar is `markup` extended), and `markup`
// carries the `html` alias, so every CodeLanguage value above resolves to a registered grammar and
// `language` can be handed to refractor unmapped. Module scope on purpose: registration mutates one
// shared refractor instance and is idempotent, so it does not belong in a component body.
refractor.register(css);
refractor.register(markup);
refractor.register(properties);
refractor.register(velocity);

interface CodeEditorProps {
  /**
   * Which grammar to highlight with. Required: there is no sensible default now that the editor serves
   * markup, stylesheets, templates and property files alike.
   */
  language: CodeLanguage;
  /** Current editor content. Fully controlled. */
  value: string;
  onChange: (value: string) => void;
  /** DOM id of the textarea, so a `<label htmlFor>` can point at it. */
  id?: string;
  /** Accessible name when there is no visible label. */
  ariaLabel?: string;
  placeholder?: string;
  readOnly?: boolean;
  /** Extra class on the wrapper, for the consuming page's sizing (the editor fills its box). */
  className?: string;
}

/**
 * Turns one refractor node into React. Prism emits nothing but text and nested `<span>`s carrying
 * `token <type>` class names, so those are the only two cases; anything else (a hast comment, a
 * doctype node) cannot occur here and is dropped rather than guessed at.
 *
 * Rendering the tree as React elements - rather than feeding `Prism.highlight()`'s HTML string to
 * `dangerouslySetInnerHTML` - is the reason refractor is used at all: no innerHTML in a library whose
 * components render inside Polarion's iframe under a strict CSP.
 *
 * Exported for the unit tests, which reach the two defensive paths that refractor's own output never
 * takes (a node that is neither text nor an element, a `className` that is not a list); consumers use
 * the component.
 */
export function renderNode(node: RootContent, key: number): ReactNode {
  if (node.type === 'text') {
    return node.value;
  }
  if (node.type !== 'element') {
    return null;
  }
  const element: Element = node;
  const classNames = element.properties?.className;
  return (
    <span className={Array.isArray(classNames) ? classNames.join(' ') : undefined} key={key}>
      {element.children.map(renderNode)}
    </span>
  );
}

/**
 * A code editor: a plain textarea for editing, with a syntax-highlighted `<pre>` painted underneath it
 * (the textarea's own text is transparent, its caret and selection are not). This is the React
 * replacement for the legacy admin pages' `<code-input>` web component, which pulled the generic
 * framework's `code-input.min.js` + `prism.js` in at runtime - a runtime `<script>` served by Polarion
 * can be loaded neither under a strict CSP nor in the test browser.
 *
 * The grammars are Prism's own, through refractor (same grammars as an ESM package: no global `Prism`,
 * no innerHTML), so the highlighting is what those pages were built against - Velocity included, whose
 * grammar the extensions used to vendor as a `prism-velocity.min.js` of their own. The token class
 * names are Prism's too (`token comment`, `token attr-name`, ...), which is why the colors in
 * CodeEditor.css are the default Prism theme that those pages loaded.
 *
 * The wrapper carries no height of its own beyond a minimum - give it one through `className` (the DMS
 * connector pages let it flex to fill the page).
 */
export default function CodeEditor({
  language,
  value,
  onChange,
  id,
  ariaLabel,
  placeholder,
  readOnly,
  className,
}: Readonly<CodeEditorProps>) {
  const highlightRef = useRef<HTMLPreElement>(null);

  // The highlight layer does not scroll on its own (it has no scrollbars); it follows the textarea.
  const handleScroll = (event: UIEvent<HTMLTextAreaElement>) => {
    const textarea = event.currentTarget;
    const highlight = highlightRef.current;
    if (highlight) {
      highlight.scrollTop = textarea.scrollTop;
      highlight.scrollLeft = textarea.scrollLeft;
    }
  };

  const handleChange = (event: ChangeEvent<HTMLTextAreaElement>) => onChange(event.target.value);

  // Memoised because a controlled editor re-renders on every keystroke while these documents are not
  // small: the exporters' default stylesheet is hundreds of lines, and its read-only pane shows all of
  // it.
  const tokens = useMemo(() => refractor.highlight(value, language).children, [value, language]);

  return (
    <div className={className ? `code-editor ${className}` : 'code-editor'}>
      <pre className="code-editor__highlight" ref={highlightRef} aria-hidden="true">
        {/* The layer's text is exactly `value` plus the one trailing newline below. That newline
            matters: a textarea shows an empty line after a trailing newline, while a <pre> whose text
            ends there does not - without the sentinel the two layers differ by a line height as soon as
            the document ends with a blank line. One sentinel for the whole document, not one per line:
            a Prism token can span newlines (a CSS block comment, a Velocity #* *# comment), so the tree
            cannot be cut into lines. */}
        <code>
          {tokens.map(renderNode)}
          {'\n'}
        </code>
      </pre>
      <textarea
        className="code-editor__input"
        id={id}
        aria-label={ariaLabel}
        placeholder={placeholder}
        readOnly={readOnly}
        value={value}
        onChange={handleChange}
        onScroll={handleScroll}
        spellCheck={false}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
      />
    </div>
  );
}
