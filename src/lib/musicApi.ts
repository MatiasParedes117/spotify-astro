export interface MusicTrack {
  id: string;
  title: string;
  artist: string;
  album: string;
  artwork: string;
  preview: string;
  url: string;
  duration: number;
}

export interface MusicApiOptions {
  signal?: AbortSignal;
  limit?: number;
}

interface ITunesTrack {
  wrapperType?: unknown;
  kind?: unknown;
  trackId?: unknown;
  trackName?: unknown;
  artistName?: unknown;
  collectionName?: unknown;
  artworkUrl100?: unknown;
  previewUrl?: unknown;
  trackViewUrl?: unknown;
  trackTimeMillis?: unknown;
}

interface ITunesSearchResponse {
  results: unknown[];
}

const musicTrackCache = new Map<string, MusicTrack | null>();
const SEARCH_TIMEOUT_MS = 15_000;

export const MusicAPI = {
  async searchTracks(query: string, { signal, limit = 8 }: MusicApiOptions = {}): Promise<MusicTrack[]> {
    const term = query.trim();
    if (!term) return [];

    const timeoutSignal = AbortSignal.timeout(SEARCH_TIMEOUT_MS);
    const requestSignal = signal
      ? AbortSignal.any([signal, timeoutSignal])
      : timeoutSignal;
    const params = new URLSearchParams({
      term,
      entity: 'song',
      country: 'CL',
      limit: String(Math.max(1, Math.min(200, Math.trunc(limit) || 8))),
    });
    let response: Response;
    try {
      response = await fetch(`https://itunes.apple.com/search?${params}`, { signal: requestSignal });
    } catch (error) {
      if (timeoutSignal.aborted && !signal?.aborted) {
        throw new Error('La búsqueda en iTunes superó el tiempo de espera');
      }
      throw error;
    }
    if (!response.ok) throw new Error(`iTunes Search respondió ${response.status}`);

    const data: unknown = await response.json();
    if (!isSearchResponse(data)) throw new Error('La respuesta de iTunes no contiene resultados');

    return data.results
      .filter(isITunesTrack)
      .map(mapITunesTrack)
      .filter((track): track is MusicTrack => track !== null);
  },

  async resolveTrack(song: string, artist: string, { signal }: Pick<MusicApiOptions, 'signal'> = {}): Promise<MusicTrack | null> {
    const key = `${normalizeMusicText(song)}|${normalizeMusicText(artist)}`;
    if (musicTrackCache.has(key)) return musicTrackCache.get(key) ?? null;

    const results = await MusicAPI.searchTracks(`${song} ${artist}`, { signal, limit: 25 });
    const normalizedTitle = normalizeMusicText(song);
    const normalizedArtist = normalizeMusicText(artist);
    const ranked = results
      .map(track => ({
        track,
        title: compareMusicText(normalizedTitle, normalizeMusicText(track.title)),
        artist: compareMusicText(normalizedArtist, normalizeMusicText(track.artist)),
      }))
      .filter(result => result.title >= 0.65 && result.artist >= 0.5 && result.track.preview)
      .sort((a, b) => (b.title * 0.75 + b.artist * 0.25) - (a.title * 0.75 + a.artist * 0.25));
    const match = ranked[0]?.track ?? null;
    musicTrackCache.set(key, match);
    return match;
  },
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isSearchResponse(value: unknown): value is ITunesSearchResponse {
  return isRecord(value) && Array.isArray(value.results);
}

function isITunesTrack(value: unknown): value is ITunesTrack {
  return isRecord(value) && value.wrapperType === 'track' && value.kind === 'song';
}

function mapITunesTrack(track: ITunesTrack): MusicTrack | null {
  const id = typeof track.trackId === 'string' || typeof track.trackId === 'number'
    ? String(track.trackId)
    : '';
  if (!id) return null;

  const artwork = secureUrl(track.artworkUrl100)?.replace(/\d+x\d+bb\./, '600x600bb.') || '';
  return {
    id,
    title: stringOr(track.trackName, 'Canción sin título'),
    artist: stringOr(track.artistName, 'Artista desconocido'),
    album: stringOr(track.collectionName, 'Sencillo'),
    artwork,
    preview: secureUrl(track.previewUrl) || '',
    url: secureUrl(track.trackViewUrl) || '',
    duration: typeof track.trackTimeMillis === 'number' && Number.isFinite(track.trackTimeMillis)
      ? track.trackTimeMillis
      : 0,
  };
}

function stringOr(value: unknown, fallback: string): string {
  return typeof value === 'string' ? value : fallback;
}

function normalizeMusicText(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\b(feat(?:uring)?|ft)\.?.*$/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function compareMusicText(expected: string, actual: string): number {
  if (!expected || !actual) return 0;
  if (expected === actual) return 1;
  if (expected.includes(actual) || actual.includes(expected)) return 0.85;

  const expectedWords = new Set(expected.split(' '));
  const actualWords = new Set(actual.split(' '));
  const common = [...expectedWords].filter(word => actualWords.has(word)).length;
  return common / Math.max(expectedWords.size, actualWords.size);
}

function secureUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' ? url.href : null;
  } catch {
    return null;
  }
}
