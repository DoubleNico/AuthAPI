import express, { Request, Response } from 'express'
import cookieParser from 'cookie-parser'
import bodyParser from 'body-parser'
import { RedisClient } from './redisClient.js'
import { AuthUtils } from './authUtils.js'
import { authMiddleware } from './authMiddleware.js'
import { ExpressResponseAdapter } from './responses/ExpressResponseAdapter.js'

const redis = new RedisClient('redis://localhost:6379')
redis.connect().catch((err) => {
  console.error('Error connecting to Redis:', err)
})

const authUtils = new AuthUtils(
  redis,
  'your-access-token-secret',
  'your-refresh-token-secret',
  '15m',
  '30d',
  false,
  'yourdomain.com'
)

const app = express()
app.use(cookieParser())
app.use(bodyParser.json())

app.use(express.static('public'))

app.post('/login', async (req: Request, res: Response): Promise<void> => {
  const { username, password } = req.body

  if (username === 'test' && password === 'password') {
    const userId = '123'
    const oldRefreshToken = req.cookies['rid']

    const responseAdapter = new ExpressResponseAdapter(res)
    await authUtils.sendAuthCookies(responseAdapter, userId, oldRefreshToken)
    res.json({ message: 'Login successful' })
    return
  }

  res.status(401).json({ message: 'Invalid username or password' })
})

app.get(
  '/protected',
  authMiddleware(authUtils),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.userId
      if (!userId) {
        res.status(401).json({ message: 'Unauthorized' })
        return
      }

      res.json({
        message: `Welcome to the protected resource, user ${userId}`,
      })
    } catch {
      res.status(500).json({ message: 'Internal server error' })
    }
  }
)

app.post('/logout', async (req: Request, res: Response): Promise<void> => {
  const refreshToken = req.cookies['rid']

  if (!refreshToken) {
    res.status(400).json({ message: 'No refresh token provided' })
    return
  }

  try {
    const responseAdapter = new ExpressResponseAdapter(res)
    await authUtils.clearAuthCookies(responseAdapter, refreshToken)

    res.json({ message: 'Logged out successfully' })
  } catch {
    res.status(500).json({ message: 'Failed to log out' })
  }
})

app.listen(3000, () => {
  console.log('Server running on http://localhost:3000')
})
