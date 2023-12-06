import { jwtDecode } from 'jwt-decode'
import Cookies from 'js-cookie'
import {
  deleteCookie,
  getCookie,
  splitCookiesString,
  appendResponseHeader
} from 'h3'

import type { AuthenticationData } from '../types'
import {
  useRequestEvent,
  useRuntimeConfig,
  useState,
  useRequestHeaders,
  navigateTo
} from '#imports'

export function useDirectusSession () {
  const event = useRequestEvent()
  const config = useRuntimeConfig().public.directus

  const accessTokenCookieName = config.auth.accessTokenCookieName
  const refreshTokenCookieName = config.auth.refreshTokenCookieName
  const msRefreshBeforeExpires = config.auth.msRefreshBeforeExpires
  const loggedInName = config.auth.loggedInFlagName

  const _accessToken = {
    get: () =>
      process.server
        ? event.context[accessTokenCookieName] ||
          getCookie(event, accessTokenCookieName)
        : Cookies.get(accessTokenCookieName),
    set: (value: string) => {
      if (process.server) {
        event.context[accessTokenCookieName] = value
        setCookie(event, accessTokenCookieName, value, {
          sameSite: 'lax',
          secure: true
        })
      } else {
        Cookies.set(accessTokenCookieName, value, {
          sameSite: 'lax',
          secure: true
        })
      }
    },
    clear: () => {
      if (process.server) {
        deleteCookie(event, accessTokenCookieName)
      } else {
        Cookies.remove(accessTokenCookieName)
      }
    }
  }

  const _refreshToken = {
    get: () => process.server && getCookie(event, refreshTokenCookieName),
    clear: () => process.server && deleteCookie(event, refreshTokenCookieName)
  }

  const _loggedIn = {
    get: () => process.client && localStorage.getItem(loggedInName),
    set: (value: boolean) =>
      process.client && localStorage.setItem(loggedInName, value.toString())
  }

  async function refresh () {
    const isRefreshOn = useState('directus-refresh-loading', () => false)
    const user = useState('directus-user')

    if (isRefreshOn.value) {
      return
    }

    isRefreshOn.value = true

    const cookie = useRequestHeaders(['cookie']).cookie || ''

    await $fetch
      .raw<AuthenticationData>('/auth/refresh', {
        baseURL: config.rest.baseUrl,
        method: 'POST',
        credentials: 'include',
        body: {
          mode: 'cookie'
        },
        headers: {
          cookie
        }
      })
      .then((res) => {
        const setCookie = res.headers.get('set-cookie') ?? ''
        const cookies = splitCookiesString(setCookie)
        for (const cookie of cookies) {
          appendResponseHeader(event, 'set-cookie', cookie)
        }
        if (res._data) {
          _accessToken.set(res._data?.data.access_token)
          _loggedIn.set(true)
        }
        isRefreshOn.value = false
        return res
      })
      .catch(async () => {
        isRefreshOn.value = false
        _accessToken.clear()
        _refreshToken.clear()
        _loggedIn.set(false)
        user.value = null
        if (process.client) {
          await navigateTo(config.auth.redirect.logout)
        }
      })
  }

  async function getToken (): Promise<string | null | undefined> {
    const accessToken = _accessToken.get()

    if (accessToken && isTokenExpired(accessToken)) {
      await refresh()
    }

    return _accessToken.get()
  }

  function isTokenExpired (token: string) {
    const decoded = jwtDecode(token) as { exp: number }
    const expires = decoded.exp * 1000 - msRefreshBeforeExpires
    return expires < Date.now()
  }

  return { refresh, getToken, _accessToken, _refreshToken, _loggedIn }
}
