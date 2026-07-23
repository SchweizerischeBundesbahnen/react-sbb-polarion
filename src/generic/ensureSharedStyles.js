/*
 * No-op replacement for the generic framework's ensureSharedStyles.
 *
 * In generic this injects the control/dropdown CSS <link>s at runtime (resolved relative to the
 * served module URL). In react-sbb-polarion those control styles are bundled into the library's own
 * stylesheet (dist/style.css), which the consuming app imports once, so no runtime injection is
 * needed. This stub keeps the copied SearchableDropdown.js `import ensureSharedStyles` resolving
 * unchanged — do not restore the injecting behavior here; add CSS to the bundled stylesheet instead.
 */
export default function ensureSharedStyles() {
  // intentionally empty — CSS ships in the library's bundled style.css
}
