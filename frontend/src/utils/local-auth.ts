import type { User } from '@supabase/supabase-js';

export const LOCAL_AUTH_COOKIE = 'botbrain-local-auth';
export const LOCAL_AUTH_EMAIL = 'local@botbrain.dev';
export const LOCAL_AUTH_PASSWORD = 'botbrain123';

export function isLocalAuthEnabled() {
  return (
    process.env.NEXT_PUBLIC_LOCAL_AUTH === 'true' ||
    (process.env.NODE_ENV !== 'production' &&
      process.env.NEXT_PUBLIC_SUPABASE_URL === 'https://example.supabase.co')
  );
}

export function getLocalAuthUser(): User {
  return {
    id: 'local-dev-user',
    app_metadata: {
      provider: 'local-dev',
      providers: ['local-dev'],
    },
    user_metadata: {
      name: 'Local Developer',
    },
    aud: 'authenticated',
    created_at: '2026-03-15T00:00:00.000Z',
    email: LOCAL_AUTH_EMAIL,
    role: 'authenticated',
    is_anonymous: false,
  } as User;
}

export function isValidLocalCredential(email: string, password: string) {
  return email.trim().toLowerCase() === LOCAL_AUTH_EMAIL && password === LOCAL_AUTH_PASSWORD;
}