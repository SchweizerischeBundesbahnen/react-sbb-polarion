// Allow importing plain CSS files as side-effect modules (Vite extracts them into the library's
// bundled stylesheet; consumers import it once via `@sbb-polarion/react-sbb-polarion/style.css`).
declare module '*.css';
