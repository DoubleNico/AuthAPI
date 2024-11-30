import { Request, NextFunction, RequestHandler } from 'express'
import { AuthUtils } from './authUtils.js'
import { ExpressResponseAdapter } from './responses/ExpressResponseAdapter.js'

declare module 'express-serve-static-core' {
  interface Request {
    userId?: string
  }
}

export const authMiddleware = (authUtils: AuthUtils): RequestHandler => {
  return async (
    req: Request,
    res: import('express').Response,
    next: NextFunction
  ): Promise<void> => {
    const accessToken = req.cookies['id']
    const refreshToken = req.cookies['rid']

    const responseAdapter = new ExpressResponseAdapter(res)

    try {
      const { userId, newAccessToken } = await authUtils.checkTokens(
        accessToken,
        refreshToken
      )
      req.userId = userId

      if (newAccessToken) {
        responseAdapter.setCookie('id', newAccessToken, {
          ...authUtils.getCookieOptions(),
          maxAge: authUtils.getExpirationInMilliseconds(
            authUtils.getAccessTokenExpiresIn()
          ),
        })
      }

      next()
    } catch {
      res.status(401).json({ message: 'Unauthorized' })
    }
  }
}
