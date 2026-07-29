import { useRef } from 'react';
import type { ChangeEvent, UIEvent } from 'react';
import './PropertiesEditor.css';

interface PropertiesEditorProps {
  /** Current editor content (a Java `.properties` document). Fully controlled. */
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

/** One highlighted run of text within a line. */
interface Token {
  kind: 'comment' | 'key' | 'separator' | 'value';
  text: string;
}

// A comment line starts with # or ! after optional leading whitespace (java.util.Properties).
const COMMENT = /^\s*[#!]/;
const IS_SPACE = /\s/;

/**
 * Splits a line at its first unescaped `=` or `:`, with the whitespace around that character counted
 * as part of the separator. Returns null when the line has no separator at all.
 *
 * Scanned by hand rather than matched with `/^((?:\\.|[^\\=:])*?)(\s*[=:]\s*)([\s\S]*)$/`: expressing
 * "up to the first unescaped separator" needs a lazy quantifier over an alternation, which backtracks
 * over every position on a line that has no separator. The scan below is single-pass. It is also the
 * only formulation that keeps the whitespace on the separator - making that quantifier greedy pulls a
 * trailing space into the key instead ("key " rather than "key" for `key : value`).
 */
function splitAtSeparator(line: string): { key: string; separator: string; value: string } | null {
  let index = 0;
  let separatorAt = -1;
  // Positions holding the second character of a `\x` pair; such a character is part of the key even
  // when it is whitespace or a separator character.
  const escaped = new Set<number>();
  while (index < line.length) {
    const char = line[index];
    if (char === '\\') {
      // A trailing lone backslash cannot start a pair, so the line has no usable separator.
      if (index + 1 >= line.length) return null;
      escaped.add(index + 1);
      index += 2;
      continue;
    }
    if (char === '=' || char === ':') {
      separatorAt = index;
      break;
    }
    index += 1;
  }
  if (separatorAt === -1) return null;

  let start = separatorAt;
  while (start > 0 && IS_SPACE.test(line[start - 1]) && !escaped.has(start - 1)) start -= 1;
  let end = separatorAt + 1;
  while (end < line.length && IS_SPACE.test(line[end])) end += 1;

  return { key: line.slice(0, start), separator: line.slice(start, end), value: line.slice(end) };
}

/**
 * Splits one `.properties` line into highlight tokens. A line is either a comment, a
 * key/separator/value triple, or - when it has no separator - a bare key (a property being typed).
 * Exported for the unit tests; consumers use the component.
 */
export function tokenizePropertiesLine(line: string): Token[] {
  if (line === '') {
    return [];
  }
  if (COMMENT.test(line)) {
    return [{ kind: 'comment', text: line }];
  }
  const split = splitAtSeparator(line);
  if (!split) {
    return [{ kind: 'key', text: line }];
  }
  const { key, separator, value } = split;
  const tokens: Token[] = [];
  if (key !== '') {
    tokens.push({ kind: 'key', text: key });
  }
  tokens.push({ kind: 'separator', text: separator });
  if (value !== '') {
    tokens.push({ kind: 'value', text: value });
  }
  return tokens;
}

/**
 * A `.properties` editor: a plain textarea for editing, with a syntax-highlighted `<pre>` painted
 * underneath it (the textarea's own text is transparent, its caret and selection are not). This is the
 * React replacement for the legacy admin pages' `<code-input lang="properties">` web component, which
 * pulled in the generic framework's `code-input.min.js` + `prism.js` at runtime. Two reasons not to
 * port that: the bundled prism build ships only markup/css/clike/javascript, so `lang="properties"`
 * highlighted nothing in the first place, and a runtime `<script>` from Polarion cannot be loaded in
 * the test browser. The tokenizer below is ~30 lines and needs no dependency; the colors match prism's
 * default theme, so the result reads like the highlighting those pages were meant to have.
 *
 * The wrapper carries no height of its own beyond a minimum - give it one through `className` (the
 * DMS connector pages let it flex to fill the page).
 */
export default function PropertiesEditor({
  value,
  onChange,
  id,
  ariaLabel,
  placeholder,
  readOnly,
  className,
}: Readonly<PropertiesEditorProps>) {
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

  // Each line is rendered with its own trailing "\n", so the layer's text is exactly `value` plus one
  // newline. That last one matters: a textarea shows an empty line after a trailing newline, while a
  // <pre> whose text ends there does not - without the sentinel the two layers differ by a line height
  // as soon as the document ends with a blank line.
  const lines = value.split('\n');

  return (
    <div className={className ? `properties-editor ${className}` : 'properties-editor'}>
      <pre className="properties-editor__highlight" ref={highlightRef} aria-hidden="true">
        <code>
          {lines.map((line, lineIndex) => (
            // Lines have no identity of their own - the index IS the identity here.
            <span className="properties-editor__line" key={lineIndex}>
              {tokenizePropertiesLine(line).map((token, tokenIndex) => (
                <span className={`properties-editor__${token.kind}`} key={tokenIndex}>
                  {token.text}
                </span>
              ))}
              {'\n'}
            </span>
          ))}
        </code>
      </pre>
      <textarea
        className="properties-editor__input"
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
