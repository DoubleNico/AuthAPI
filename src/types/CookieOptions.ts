/**
 * The CookieOptions interface defines the options for setting cookies.
 */
export interface CookieOptions {
  /**
   * Indicates if the cookie is accessible only through the HTTP protocol.
   * Defaults to `true`.
   */
  httpOnly?: boolean

  /**
   * Indicates if the cookie should be sent only over secure (HTTPS) connections.
   * Defaults to `false`.
   */
  secure?: boolean

  /**
   * Indicates the same-site policy for the cookie.
   * Can be 'strict', 'lax', or 'none'.
   * Defaults to 'lax'.
   */
  sameSite?: 'strict' | 'lax' | 'none'

  /**
   * The path within the site for which the cookie is valid.
   * Defaults to '/'.
   */
  path?: string

  /**
   * The domain for which the cookie is valid.
   * Defaults to the current domain.
   */
  domain?: string

  /**
   * The maximum age of the cookie in seconds.
   * Defaults to session duration.
   */
  maxAge?: number
}
