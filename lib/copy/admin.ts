// Every word on the developer's side (/login and the dashboard). English only.
import type { LoginError } from '@/lib/auth/login';

export const adminCopy = {
  login: {
    pageTitle: 'Sign in',
    label: 'Access code',
    submit: 'Open dashboard',
    opening: 'Opening…',
    errors: {
      mismatch: "That access code didn't match.",
      locked: 'Too many attempts. Try again in 15 minutes.',
    } satisfies Record<LoginError, string>,
  },
  shell: {
    signOut: 'Sign out',
    pageTitle: 'Chats',
    emptyBody: 'Reports from your clients will show here.',
  },
} as const;
