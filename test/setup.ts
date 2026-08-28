// Runs before every test file (see vitest.config.ts setupFiles).
//
// 1. Loads the library's own bundled control CSS (tokens + searchable-dropdown/buttons/etc.), the same
//    stylesheet consumers import, so the browser renders components with their real borders, gradients
//    and --sbb-* tokens - the visual layer would otherwise screenshot unstyled markup.
// 2. Registers @testing-library/jest-dom matchers (toHaveClass, toBeDisabled, ...) for the behavior
//    layer, on top of Vitest browser's own retryable expect.element matchers.
// 3. Stops transitions and animations, so a capture cannot land mid-fade.
import '@testing-library/jest-dom/vitest';
import '../src/generic/css/controls.css';

// Transitions and animations are off for every capture. A screenshot taken mid-fade is a reference that
// only sometimes reproduces, and the durations are react-sbb-polarion's, which can change them without
// this repository noticing. Killing them removes the race instead of outrunning it with a sleep.
//
// Grayscale antialiasing is NOT pinned here: `-webkit-font-smoothing` is implemented only on macOS in
// Blink, so on the Linux container the rule parses and is ignored - a reference captured with it is
// byte-identical to one captured without. `--disable-lcd-text` in vitest.config.ts is the platform
// independent way to ask for the same thing.
const stillness = document.createElement('style');
stillness.textContent = '*, *::before, *::after { transition: none !important; animation: none !important; }';
document.head.appendChild(stillness);
