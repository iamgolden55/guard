/**
 * Uploads photos taken as evidence for venue checks and incident reports.
 *
 * Until the server could store them (`POST /api/v1/evidence-photos/`), no
 * photo was ever kept: venue checks tried to send the photo itself and failed
 * on the phone (Sentry REACT-NATIVE-P); incident photos never left it. A photo
 * is now uploaded on its own and the check or report carries its URL.
 *
 * A photo must never cost the officer the check or report it belongs to, so
 * `uploadEvidencePhotos` separates two kinds of failure:
 * - worth retrying (no signal, timeout, server hiccup): it throws, and a
 *   queued report is retried later with its photos;
 * - final (storage not configured yet — 503 — or the photo refused): it counts
 *   the photo as missing and carries on; the caller says so in the record.
 */
import axios from 'axios';
import { API_BASE_URL, API_PREFIX } from '../config/api.config';
import { logger } from '../utils/logger';

const UPLOAD_URL = `${API_BASE_URL}${API_PREFIX}/evidence-photos/`;
const UPLOAD_TIMEOUT_MS = 60000;

/** Upload one photo; resolves with the URL to store on the check or report. */
export async function uploadEvidencePhoto(uri: string): Promise<string> {
  const form = new FormData();
  const isPng = uri.toLowerCase().endsWith('.png');
  form.append('file', {
    uri,
    type: isPng ? 'image/png' : 'image/jpeg',
    name: isPng ? 'evidence.png' : 'evidence.jpg',
  } as any);
  const response = await axios.post(UPLOAD_URL, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: UPLOAD_TIMEOUT_MS,
  });
  return response.data.url;
}

/** The upload will fail the same way however often it is tried. */
export function isFinalUploadFailure(error: any): boolean {
  const status = error?.response?.status;
  if (status === 503) return true; // storage not configured on the server
  return typeof status === 'number' && status >= 400 && status < 500 &&
    status !== 401 && status !== 408 && status !== 429;
}

/**
 * Upload each photo. Resolves with the URLs that were stored and how many
 * could never be; throws on a failure worth retrying.
 */
export async function uploadEvidencePhotos(uris: string[]): Promise<{ urls: string[]; missing: number }> {
  const urls: string[] = [];
  let missing = 0;
  for (const uri of uris) {
    try {
      urls.push(await uploadEvidencePhoto(uri));
    } catch (error: any) {
      if (!isFinalUploadFailure(error)) throw error;
      missing += 1;
      logger.warn('[EvidencePhoto] Photo not stored', {
        status: error?.response?.status,
        response: error?.response?.data,
      });
    }
  }
  return { urls, missing };
}

/** The line added to a record whose photos could not all be kept. */
export function missingPhotosNote(missing: number): string {
  return missing === 1
    ? '(1 photo could not be uploaded.)'
    : `(${missing} photos could not be uploaded.)`;
}
