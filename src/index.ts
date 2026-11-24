/**
 * Host half of `dsh-deepblue-hud`.
 *
 * The bundle row mounts this module so the Loader has one entry named after the
 * package; every pixel of the HUD lives in the Client half (`./client`).
 *
 * 0.2 ships **no Host-side data source on purpose**. The Client half renders a
 * static placeholder snapshot, and the system-vitals block stays a placeholder
 * until a Host→Client carrier is chosen — an installed plugin has no
 * `host.call` seat (that verb belongs to dynamic Cordis packages only), so the
 * candidate carriers are a Host `webServer` route, a Typert Remote namespace, or
 * a session projection. See `README.md` § Roadmap before adding sampling here:
 * sampling without a carrier is dead code.
 */

/** Stable plugin name; Cordis uses it as the fiber label. */
export const name = 'dsh-deepblue-hud'

/**
 * Activate the Host half.
 *
 * Deliberately empty in 0.2: nothing to register, nothing to dispose. Keeping
 * the module present (and side-effect free) is what makes the bundle row
 * mountable, and keeps the file's shape ready for the 0.3 sampling loop.
 */
export function apply(): void {}
