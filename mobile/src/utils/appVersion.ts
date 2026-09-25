/**
 * Tell the server which build of the app is calling, and hear when it is too old.
 *
 * Mobile builds can't be rolled back and the API has no version negotiation,
 * so an old build with a known defect — like the check-in queue fixed in
 * September 2026 — keeps running until the officer happens to update. The
 * server compares `X-App-Build` with a configured minimum and answers 426 when
 * a build is below it; this module sends the headers and raises the
 * "update required" signal the app shell turns into a blocking message.
 */
import axios from 'axios';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

function buildNumber(): string {
  const config = Constants.expoConfig;
  const value = Platform.OS === 'ios' ? config?.ios?.buildNumber : config?.android?.versionCode;
  return value != null ? String(value) : '0';
}

export const APP_BUILD = buildNumber();

export function appVersionHeaders(): Record<string, string> {
  return { 'X-App-Platform': Platform.OS, 'X-App-Build': APP_BUILD };
}

export const UPDATE_REQUIRED_STATUS = 426;

type Listener = () => void;
const listeners = new Set<Listener>();

/** Subscribe to "this build is too old". Returns an unsubscribe function. */
export function onUpdateRequired(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function notifyUpdateRequired(): void {
  for (const listener of listeners) {
    try {
      listener();
    } catch {
      // A listener's failure must not break the request path.
    }
  }
}

let installed = false;

/** Add the headers and the 426 check to every axios request. Call once at start-up. */
export function installAppVersionOnAxios(): void {
  if (installed) return;
  installed = true;
  Object.assign(axios.defaults.headers.common, appVersionHeaders());
  axios.interceptors.response.use(undefined, (error) => {
    if (error?.response?.status === UPDATE_REQUIRED_STATUS) notifyUpdateRequired();
    return Promise.reject(error);
  });
}
