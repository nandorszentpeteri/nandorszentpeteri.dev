/**
 * Feature flags. Small, boring switches for things that are temporarily off but
 * meant to come back — the content stays on disk, only the wiring is cut.
 */

/**
 * Writings (`content/writings/`). While `false` the folder is not mounted into
 * the virtual filesystem, the `writings` / `writing` / `blog` aliases are gone
 * and the classic page drops its WRITING section. Flip to `true` to restore.
 */
export const WRITINGS_ENABLED = false;
