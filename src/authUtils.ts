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
    accessTokenExpiresIn: string = '15min',
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
      } catch (error) {
        console.error('Failed to delete old refresh token:', error)
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

  public async clearAuthCookies(
    res: GeneralResponse,
    refreshToken: string
  ): Promise<void> {
    try {
      const data = jwt.verify(
        refreshToken,
        this.refreshTokenSecret
      ) as RefreshTokenData
      await this.redis.del(data.refreshTokenId)
    } catch (error) {
      console.error('Failed to clear auth cookies:', error)
    }
    res.clearCookie('id', this.cookieOptions)
    res.clearCookie('rid', this.cookieOptions)
  }

  public async checkTokens(accessToken: string, refreshToken: string) {
    try {
      const data = jwt.verify(
        accessToken,
        this.accessTokenSecret
      ) as AccessTokenData
      return { userId: data.userId }
    } catch {
      if (!refreshToken) throw new TRPCError({ code: 'UNAUTHORIZED' })

      let data: RefreshTokenData
      try {
        data = jwt.verify(
          refreshToken,
          this.refreshTokenSecret
        ) as RefreshTokenData
      } catch {
        throw new TRPCError({ code: 'UNAUTHORIZED' })
      }

      const userId = await this.redis.get(data.refreshTokenId)
      if (!userId) throw new TRPCError({ code: 'UNAUTHORIZED' })

      await this.redis.del(data.refreshTokenId)

      const newRefreshTokenId = `${userId}-${Date.now()}`
      const newRefreshToken = jwt.sign(
        { userId, refreshTokenId: newRefreshTokenId },
        this.refreshTokenSecret,
        { expiresIn: this.refreshTokenExpiresIn }
      )

      const newAccessToken = jwt.sign({ userId }, this.accessTokenSecret, {
        expiresIn: this.accessTokenExpiresIn,
      })

      await this.redis.set(
        newRefreshTokenId,
        userId,
        this.parseExpiration(this.refreshTokenExpiresIn)
      )

      return { userId, newAccessToken, newRefreshToken }
    }
  }

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
