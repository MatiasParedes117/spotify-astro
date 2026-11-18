import assert from 'node:assert/strict';
import test from 'node:test';
import { MusicAPI } from '../src/lib/musicApi.ts';

function itunesTrack({
  id = 1,
  title = 'Canción de prueba',
  artist = 'Artista de prueba',
  preview = 'https://audio.example/preview.m4a',
  artwork = 'https://images.example/100x100bb.jpg',
  url = 'https://music.example/track/1',
} = {}) {
  return {
    wrapperType: 'track',
    kind: 'song',
    trackId: id,
    trackName: title,
    artistName: artist,
    collectionName: 'Álbum de prueba',
    artworkUrl100: artwork,
    previewUrl: preview,
    trackViewUrl: url,
    trackTimeMillis: 180_000,
  };
}

function mockFetch(t, implementation) {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = implementation;
  t.after(() => {
    globalThis.fetch = originalFetch;
  });
}

test('searchTracks skips empty terms and requests a bounded number of results', async (t) => {
  mockFetch(t, async (input) => {
    const url = new URL(input);
    assert.equal(url.searchParams.get('term'), 'Billie Eilish');
    assert.equal(url.searchParams.get('entity'), 'song');
    assert.equal(url.searchParams.get('country'), 'CL');
    assert.equal(url.searchParams.get('limit'), '200');
    return Response.json({
      results: [
        itunesTrack({ id: 8, artwork: 'http://images.example/unsafe.jpg' }),
        { wrapperType: 'collection', kind: 'album', trackId: 9 },
        itunesTrack({ id: 10, preview: 'http://audio.example/insecure.m4a' }),
      ],
    });
  });

  assert.deepEqual(await MusicAPI.searchTracks('   '), []);
  const tracks = await MusicAPI.searchTracks(' Billie Eilish ', { limit: 500 });
  assert.equal(tracks.length, 2);
  assert.equal(tracks[0].artwork, '');
  assert.equal(tracks[1].preview, '');
});

test('searchTracks surfaces API failures', async (t) => {
  mockFetch(t, async () => new Response('', { status: 403 }));
  await assert.rejects(MusicAPI.searchTracks('Bad Bunny'), /respondió 403/);
});

test('searchTracks respects caller cancellation', async (t) => {
  mockFetch(t, async (_input, { signal }) => new Promise((_resolve, reject) => {
    signal.addEventListener('abort', () => reject(signal.reason), { once: true });
  }));
  const controller = new AbortController();
  const request = MusicAPI.searchTracks('Rosalía', { signal: controller.signal });
  controller.abort();
  await assert.rejects(request, { name: 'AbortError' });
});

test('searchTracks reports its timeout separately from caller cancellation', async (t) => {
  const originalTimeout = AbortSignal.timeout;
  AbortSignal.timeout = () => AbortSignal.abort(new DOMException('Timed out', 'TimeoutError'));
  t.after(() => {
    AbortSignal.timeout = originalTimeout;
  });
  mockFetch(t, async (_input, { signal }) => {
    throw signal.reason;
  });

  await assert.rejects(MusicAPI.searchTracks('Gepe'), /superó el tiempo de espera/);
});

test('resolveTrack selects and caches the best preview match', async (t) => {
  let requests = 0;
  mockFetch(t, async () => {
    requests++;
    return Response.json({
      results: [
        itunesTrack({ id: 21, title: 'Canción de prueba', artist: 'Otro artista' }),
        itunesTrack({ id: 22, title: 'Otra canción', artist: 'Artista de prueba' }),
        itunesTrack({ id: 23 }),
      ],
    });
  });

  const first = await MusicAPI.resolveTrack('Canción de prueba', 'Artista de prueba');
  const second = await MusicAPI.resolveTrack('Canción de prueba', 'Artista de prueba');
  assert.equal(first?.id, '23');
  assert.equal(second?.id, '23');
  assert.equal(requests, 1);
});
