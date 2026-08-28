// Runs before every test file (see vitest.config.ts setupFiles).
//
// 1. Loads the library's own bundled control CSS (tokens + searchable-dropdown/buttons/etc.), the same
//    stylesheet consumers import, so the browser renders components with their real borders, gradients
//    and --sbb-* tokens - the visual layer would otherwise screenshot unstyled markup.
// 2. Registers @testing-library/jest-dom matchers (toHaveClass, toBeDisabled, ...) for the behavior
//    layer, on top of Vitest browser's own retryable expect.element matchers.
// 3. Pins text to grayscale antialiasing, which is what makes a reference reproducible.
import '@testing-library/jest-dom/vitest';
import '../src/generic/css/controls.css';

// Chromium decides per layer how to rasterize text, and the decision depends on the compositing of the
// page as a whole - which differs between "this file ran on its own" and "this file ran after that one".
// The result is the same glyphs at the same coordinates with a different gamma, and a reference that
// agrees with the runs that had the same files ahead of it and with no others. Asking for grayscale
// explicitly takes the decision away from the compositor.
//
// Test-only, and the references are regenerated with it so they and the runs agree.
const textRendering = document.createElement('style');
textRendering.textContent = '*, *::before, *::after { -webkit-font-smoothing: antialiased !important; }';
document.head.appendChild(textRendering);
