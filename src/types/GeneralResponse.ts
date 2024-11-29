import { CookieOptions } from './CookieOptions.js'

/**
 * Interface representing a general response with methods to manage cookies.
 */
export interface GeneralResponse {
  /**
   * Sets a cookie with the specified name, value, and options.
   *
   * @param name - The name of the cookie.
   * @param value - The value of the cookie.
   * @param options - Additional options for the cookie.
   */
  setCookie(name: string, value: string, options: CookieOptions): void

  /**
   * Clears a cookie with the specified name and options.
   *
   * @param name - The name of the cookie to clear.
   * @param options - Additional options for clearing the cookie.
   */
  clearCookie(name: string, options: CookieOptions): void
}
