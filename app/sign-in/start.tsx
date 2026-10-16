'use client';

import { useEffect, useRef } from 'react';
import { useSignIn, useUser } from '@clerk/nextjs';

/** One Google hop. No Clerk hosted sign-in screen. */
export function StartGoogle() {
  const started = useRef(false);
  const { isLoaded, signIn } = useSignIn();
  const { isLoaded: userLoaded, user } = useUser();

  useEffect(() => {
    if (!isLoaded || !userLoaded || started.current) return;
    if (user) {
      window.location.replace('/control-room');
      return;
    }
    if (!signIn) return;
    started.current = true;
    signIn
      .authenticateWithRedirect({
        strategy: 'oauth_google',
        redirectUrl: '/sso-callback',
        redirectUrlComplete: '/control-room',
      })
      .catch(() => {
        started.current = false;
        window.location.replace('/');
      });
  }, [isLoaded, userLoaded, user, signIn]);

  return null;
}
