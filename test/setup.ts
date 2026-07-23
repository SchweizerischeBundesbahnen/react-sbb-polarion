// Runs before every test file (see vitest.config.ts setupFiles).
//
// 1. Loads the library's own bundled control CSS (tokens + searchable-dropdown/buttons/etc.), the same
//    stylesheet consumers import, so the browser renders components with their real borders, gradients
//    and --sbb-* tokens - the visual layer would otherwise screenshot unstyled markup.
// 2. Registers @testing-library/jest-dom matchers (toHaveClass, toBeDisabled, ...) for the behavior
//    layer, on top of Vitest browser's own retryable expect.element matchers.
import '@testing-library/jest-dom/vitest';
import '../src/generic/css/controls.css';
