import jwt from 'jsonwebtoken'
import { RedisClient } from './redisClient.js'
import { TRPCError } from '@trpc/server'
import { CookieOptions } from './types/CookieOptions.js'
import { GeneralResponse } from './types/GeneralResponse.js'
import { RefreshTokenData } from './types/RefreshTokenData.js'
import { AccessTokenData } from './types/AccessTokenData.js'

export class AuthUtils {
  private redis: RedisClient
  private accessTokenSecret: string
  private refreshTokenSecret: string
  private accessTokenExpiresIn: string
  private refreshTokenExpiresIn: string
  private cookieOptions: CookieOptions

  constructor(
    redis: RedisClient,
    accessTokenSecret: string,
    refreshTokenSecret: string,
    accessTokenExpiresIn: string = '15m',
    refreshTokenExpiresIn: string = '30d',
    isProduction: boolean = false,
    domain: string = ''
  ) {
    this.redis = redis
    this.accessTokenSecret = accessTokenSecret
    this.refreshTokenSecret = refreshTokenSecret
    this.accessTokenExpiresIn = accessTokenExpiresIn
    this.refreshTokenExpiresIn = refreshTokenExpiresIn

    this.cookieOptions = {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      path: '/',
      domain: isProduction ? `.${domain}` : '',
    }
  }

  /**
   * Returns the Redis client instance.
   */
  public getRedis(): RedisClient {
    return this.redis
  }

  /**
   * Returns the access token secret.
   */
  public getAccessTokenSecret(): string {
    return this.accessTokenSecret
  }

  /**
   * Returns the refresh token secret.
   */
  public getRefreshTokenSecret(): string {
    return this.refreshTokenSecret
  }

  /**
   * Returns the access token expiration time as a string.
   */
  public getAccessTokenExpiresIn(): string {
    return this.accessTokenExpiresIn
  }

  /**
   * Returns the refresh token expiration time as a string.
   */
  public getRefreshTokenExpiresIn(): string {
    return this.refreshTokenExpiresIn
  }

  /**
   * Returns the cookie options.
   */
  public getCookieOptions(): CookieOptions {
    return this.cookieOptions
  }

  /**
   * Parses the expiration time string and returns the equivalent time in milliseconds.
   * @param expiresIn - The expiration time string (e.g., '15m', '30d').
   * @returns The expiration time in milliseconds.
   */
  public getExpirationInMilliseconds(expiresIn: string): number {
    return this.parseExpiration(expiresIn) * 1000
  }

  /**
   * Sends authentication cookies to the client.
   * @param res - The GeneralResponse object.
   * @param userId - The user ID.
   * @param oldRefreshToken - The old refresh token (optional).
   */
  public async sendAuthCookies(
    res: GeneralResponse,
    userId: string,
    oldRefreshToken?: string
  ): Promise<void> {
    if (oldRefreshToken) {
      try {
        const oldData = jwt.verify(
          oldRefreshToken,
          this.refreshTokenSecret
        ) as RefreshTokenData
        await this.redis.del(oldData.refreshTokenId)
        console.log(`Deleted old refresh token: ${oldData.refreshTokenId}`)
      } catch {
        console.error('Failed to delete old refresh token:', oldRefreshToken)
      }
    }

    const refreshTokenId = `${userId}-${Date.now()}`
    const { accessToken, refreshToken } = this.createAuthTokens(
      userId,
      refreshTokenId
    )

    await this.redis.set(
      refreshTokenId,
      userId,
      this.parseExpiration(this.refreshTokenExpiresIn)
    )

    res.setCookie('id', accessToken, {
      ...this.cookieOptions,
      maxAge: this.parseExpiration(this.accessTokenExpiresIn) * 1000,
    })
    res.setCookie('rid', refreshToken, {
      ...this.cookieOptions,
      maxAge: this.parseExpiration(this.refreshTokenExpiresIn) * 1000,
    })
  }

  /**
   * Clears authentication cookies from the client.
   * @param res - The GeneralResponse object.
   * @param refreshToken - The refresh token.
   */
  public async clearAuthCookies(
    res: GeneralResponse,
    refreshToken: string
  ): Promise<void> {
    try {
      const data = jwt.verify(
        refreshToken,
        this.refreshTokenSecret
      ) as RefreshTokenData
      console.log(`Deleting refresh token: ${data.refreshTokenId}`)
      await this.redis.del(data.refreshTokenId)
    } catch (error) {
      console.error('Failed to clear auth cookies:', error)
    }
    res.clearCookie('id', this.cookieOptions)
    res.clearCookie('rid', this.cookieOptions)
  }

  /**
   * Checks the validity of the access token and refresh token.
   * @param accessToken - The access token.
   * @param refreshToken - The refresh token.
   * @returns An object containing the userId, newAccessToken, and newRefreshToken if the tokens are valid.
   */
  public async checkTokens(accessToken: string, refreshToken: string) {
    try {
      const data = jwt.verify(
        accessToken,
        this.accessTokenSecret
      ) as AccessTokenData

      console.log('Access token is valid for user:', data.userId)
      return { userId: data.userId, newAccessToken: null }
    } catch {
      console.error('Access token verification failed:', accessToken)

      if (!refreshToken) throw new TRPCError({ code: 'UNAUTHORIZED' })

      let data: RefreshTokenData
      try {
        data = jwt.verify(
          refreshToken,
          this.refreshTokenSecret
        ) as RefreshTokenData
      } catch {
        console.error('Refresh token verification failed:', refreshToken)
        throw new TRPCError({ code: 'UNAUTHORIZED' })
      }

      const userId = await this.redis.get(data.refreshTokenId)
      if (!userId) {
        console.error('Refresh token not found in Redis:', data.refreshTokenId)
        throw new TRPCError({ code: 'UNAUTHORIZED' })
      }

      const newAccessToken = jwt.sign({ userId }, this.accessTokenSecret, {
        expiresIn: this.accessTokenExpiresIn,
      })

      console.log('Generated a new access token for user:', userId)

      return { userId, newAccessToken }
    }
  }

  /**
   * Creates and returns a new access token and refresh token.
   * @param userId - The user ID.
   * @param refreshTokenId - The refresh token ID.
   * @returns An object containing the refreshToken and accessToken.
   */
  private createAuthTokens(
    userId: string,
    refreshTokenId: string
  ): { refreshToken: string; accessToken: string } {
    const refreshToken = jwt.sign(
      { userId, refreshTokenId },
      this.refreshTokenSecret,
      { expiresIn: this.refreshTokenExpiresIn }
    )

    const accessToken = jwt.sign({ userId }, this.accessTokenSecret, {
      expiresIn: this.accessTokenExpiresIn,
    })

    return { refreshToken, accessToken }
  }

  /**
   * Parses the expiration time string and returns the equivalent time in seconds.
   * @param expiresIn - The expiration time string (e.g., '15m', '30d').
   * @returns The expiration time in seconds.
   */
  private parseExpiration(expiresIn: string): number {
    const match = expiresIn.match(/^(\d+)([a-z]+)$/i)
    if (!match) throw new Error(`Invalid expiresIn format: ${expiresIn}`)

    const value = parseInt(match[1], 10)
    const unit = match[2].toLowerCase()

    switch (unit) {
      case 's':
        return value
      case 'm':
        return value * 60
      case 'h':
        return value * 60 * 60
      case 'd':
        return value * 24 * 60 * 60
      default:
        throw new Error(`Unsupported expiresIn unit: ${unit}`)
    }
  }
}
