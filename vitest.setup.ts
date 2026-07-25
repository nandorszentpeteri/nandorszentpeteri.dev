import "@testing-library/jest-dom/vitest";

/**
 * jsdom ships no `matchMedia`, and two components ask it real questions:
 * TypedRole checks prefers-reduced-motion, Terminal checks for a coarse pointer
 * before stealing focus. Without this they throw on render rather than fail on
 * behaviour, which makes the failure look unrelated to the test.
 *
 * Everything reports as not matching, which is the desktop / motion-allowed
 * case. A test that cares about the other branch should override this.
 */
if (!window.matchMedia) {
  window.matchMedia = (query: string): MediaQueryList => ({
    media: query,
    matches: false,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  });
}
