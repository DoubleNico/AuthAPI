import { Response } from 'express'
import { GeneralResponse } from '../types/GeneralResponse.js'
import { CookieOptions } from '../types/CookieOptions.js'

export class ExpressResponseAdapter implements GeneralResponse {
  private res: Response

  constructor(res: Response) {
    this.res = res
  }

  setCookie(name: string, value: string, options: CookieOptions): void {
    this.res.cookie(name, value, options)
  }

  clearCookie(name: string, options: CookieOptions): void {
    this.res.clearCookie(name, options)
  }
}
