import { AsyncLocalStorage } from 'node:async_hooks';

export type SessionCreds = {
  googleRefresh: string;
  ghlKey: string;
  ghlLocation: string;
};

const empty: SessionCreds = { googleRefresh: '', ghlKey: '', ghlLocation: '' };
const store = new AsyncLocalStorage<SessionCreds>();

export function currentCreds() {
  return store.getStore() || empty;
}

export function withCreds<T>(creds: SessionCreds, run: () => Promise<T>) {
  return store.run(creds, run);
}
