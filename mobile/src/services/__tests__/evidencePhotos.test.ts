/**
 * Photo evidence reaches the server, and a photo never costs the officer the
 * check it belongs to.
 *
 * Venue checks used to try to send the photo itself, which failed on the
 * phone (Sentry REACT-NATIVE-P) and never fitted the server's field; incident
 * photos never left the phone. Photos are now uploaded to
 * /api/v1/evidence-photos/ and the check carries the URL.
 */
import axios from 'axios';

jest.mock('../../config/api.config', () => ({
  API_BASE_URL: 'https://api.test',
  API_PREFIX: '/api/v1',
}));
jest.mock('../api', () => ({ apiService: { post: jest.fn() } }));

import { apiService } from '../api';
import { isFinalUploadFailure, uploadEvidencePhotos } from '../evidencePhotoService';
import { shiftChecksService } from '../shiftChecksService';

const upload = jest.spyOn(axios, 'post');
const send = apiService.post as jest.Mock;
const STORED = 'https://api.test/api/v1/evidence-photos/c/7/abc.jpg';

const status = (code: number) => Object.assign(new Error(`status ${code}`), { response: { status: code, data: {} } });
const offline = () => Object.assign(new Error('Network Error'), { code: 'ERR_NETWORK' });

beforeEach(() => {
  upload.mockReset();
  send.mockReset();
  send.mockResolvedValue({ id: 1 });
});

describe('uploadEvidencePhotos', () => {
  it('uploads each photo as a file and returns the stored URLs', async () => {
    upload.mockResolvedValue({ data: { url: STORED } });

    await expect(uploadEvidencePhotos(['file:///a.jpg', 'file:///b.png'])).resolves.toEqual({
      urls: [STORED, STORED],
      missing: 0,
    });
    const [url, form, config] = upload.mock.calls[0] as any[];
    expect(url).toBe('https://api.test/api/v1/evidence-photos/');
    expect(form).toBeInstanceOf(FormData);
    expect(config.headers['Content-Type']).toBe('multipart/form-data');
  });

  it('counts a photo the server can never store as missing, and carries on', async () => {
    upload
      .mockRejectedValueOnce(status(503)) // storage not configured
      .mockRejectedValueOnce(status(400)) // not a photo
      .mockResolvedValueOnce({ data: { url: STORED } });

    await expect(uploadEvidencePhotos(['a', 'b', 'c'])).resolves.toEqual({ urls: [STORED], missing: 2 });
  });

  it('throws when trying again later could work', async () => {
    upload.mockRejectedValueOnce(offline());
    await expect(uploadEvidencePhotos(['a'])).rejects.toThrow('Network Error');

    for (const code of [401, 408, 429, 500, 502]) {
      expect(isFinalUploadFailure(status(code))).toBe(false);
    }
    expect(isFinalUploadFailure(offline())).toBe(false);
  });
});

describe('a venue check with a photo', () => {
  const check = {
    shift: 42,
    location_name: 'Gents',
    condition: 'poor',
    needs_attention: true,
    is_out_of_order: false,
    supplies_needed: [],
    photo_uri: 'file:///photo.jpg',
  } as any;

  it('uploads the photo and sends its URL with the check', async () => {
    upload.mockResolvedValueOnce({ data: { url: STORED } });

    await shiftChecksService.submitToiletCheck(check);

    const [endpoint, payload] = send.mock.calls[0];
    expect(endpoint).toBe('/api/v1/toilet-checks/');
    expect(payload.photo_evidence).toBe(STORED);
    expect(payload).not.toHaveProperty('photo_uri');
  });

  it.each([
    ['storage is not configured', status(503)],
    ['there is no signal', offline()],
  ])('still sends the check when %s, and says the photo is missing', async (_label, error) => {
    upload.mockRejectedValueOnce(error);

    await shiftChecksService.submitToiletCheck({ ...check, notes: 'Floor flooded' });

    const [, payload] = send.mock.calls[0];
    expect(payload).not.toHaveProperty('photo_evidence');
    expect(payload.notes).toBe('Floor flooded\n\n(1 photo could not be uploaded.)');
  });

  it('sends a check without a photo as before', async () => {
    await shiftChecksService.submitToiletCheck({ ...check, photo_uri: undefined });

    expect(upload).not.toHaveBeenCalled();
    expect(send.mock.calls[0][1]).not.toHaveProperty('photo_evidence');
  });
});
