// Allow importing plain CSS files as side-effect modules (Vite extracts them into the library's
// bundled stylesheet; consumers import it once via `@sbb-polarion/react-sbb-polarion/style.css`).
declare module '*.css';

// A stylesheet imported as a string (`?inline`), for a shadow root: Vite leaves it out of style.css.
declare module '*.css?inline' {
  const css: string;
  export default css;
}
