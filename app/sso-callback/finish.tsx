'use client';

import { AuthenticateWithRedirectCallback } from '@clerk/nextjs';

export function Finish() {
  return (
    <AuthenticateWithRedirectCallback
      signInForceRedirectUrl="/control-room"
      signUpForceRedirectUrl="/control-room"
      signInFallbackRedirectUrl="/control-room"
      signUpFallbackRedirectUrl="/control-room"
      continueSignUpUrl="/"
    />
  );
}
