import { NextResponse } from 'next/server'
import { getLocalAuthUser, isLocalAuthEnabled, LOCAL_AUTH_COOKIE } from '@/utils/local-auth'

export async function GET(request: Request) {
  if (!isLocalAuthEnabled()) {
    return NextResponse.json({ user: null, localAuth: false })
  }

  const cookieHeader = request.headers.get('cookie') || ''
  const isAuthenticated = cookieHeader
    .split(';')
    .map((part) => part.trim())
    .some((part) => part === `${LOCAL_AUTH_COOKIE}=true`)

  return NextResponse.json({
    user: isAuthenticated ? getLocalAuthUser() : null,
    localAuth: true,
  })
}