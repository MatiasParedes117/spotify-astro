/* =====================================================================
 * Spotify Astro — Reproductor con muestras públicas de iTunes
 * La API solo entrega previews cortos; no hay reproducción de canciones completas.
 * El estado se persiste en LocalStorage para sobrevivir a la navegación
 * entre páginas y a las recargas.
 * ================================================================== */

const PLAYER_STATE_KEY = "playerState";

const Player = {
  audio: new Audio(),
  preview: null,
  audioStatus: "idle",
  song: null,
  queue: [],
  index: -1,
  context: { type: "", id: "", label: "" },
  playing: false,
  shuffle: false,
  repeat: "none",   // "none" | "all" | "one"
  volume: 0.7,
  currentTime: 0,
  duration: 0,
  liked: new Set(Store.get("liked") || []),

  get progress() {
    return this.duration > 0 ? this.currentTime / this.duration : 0;
  },
};

/* ─── helpers ─── */
function fmtTime(sec) {
  if (!sec || isNaN(sec)) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function savePlayerState() {
  Store.set(PLAYER_STATE_KEY, {
    songId: Player.song?.id || null,
    queue: Player.queue,
    index: Player.index,
    context: Player.context,
    playing: Player.playing,
    shuffle: Player.shuffle,
    repeat: Player.repeat,
    volume: Player.volume,
    currentTime: Player.currentTime,
    duration: Player.duration,
    savedAt: Date.now(),
  });
}

function restorePlayerState() {
  const state = Store.get(PLAYER_STATE_KEY);
  if (!state || !state.songId) return;
  const song = DB.song(state.songId);
  if (!song) return;

  const queue = Array.isArray(state.queue) ? state.queue.filter(id => DB.song(id)) : [];
  Player.queue = queue.length ? queue : [song.id];
  const savedIndex = Number(state.index);
  Player.index = Number.isFinite(savedIndex) ? Math.max(0, Math.min(savedIndex, Player.queue.length - 1)) : 0;
  const realIndex = Player.queue.indexOf(song.id);
  if (realIndex >= 0) Player.index = realIndex;

  Player.context = state.context && typeof state.context === "object"
    ? { type: state.context.type || "", id: state.context.id || "", label: state.context.label || "" }
    : { type: "", id: "", label: "" };
  Player.song = song;
  Player.playing = false;
  Player.shuffle = !!state.shuffle;
  Player.repeat = ["none", "all", "one"].includes(state.repeat) ? state.repeat : "none";
  Player.volume = typeof state.volume === "number" ? Math.max(0, Math.min(1, state.volume)) : 0.7;
  Player.duration = song.duration || Number(state.duration) || 180;
  Player.currentTime = 0;
  Player.audio.volume = Player.volume;
}

function dispatchPlayerChange() {
  savePlayerState();
  window.dispatchEvent(new CustomEvent("sp2:playerchange"));
}

function clearPlayerAudio() {
  _previewController?.abort();
  _previewController = null;
  Player.preview = null;
  Player.audio.pause();
  Player.audio.removeAttribute("src");
  Player.audio.load();
}

let _previewController = null;

async function loadTrackPreview() {
  const song = Player.song;
  if (!song) return;

  clearPlayerAudio();
  Player.audioStatus = "loading";
  Player.playing = false;
  Player.currentTime = 0;
  Player.duration = song.duration || 180;
  dispatchPlayerChange();

  const controller = new AbortController();
  _previewController = controller;
  try {
    const artist = DB.artist(song.artistId);
    const preview = await MusicAPI.resolveTrack(song.title, artist?.name || "", { signal: controller.signal });
    if (controller.signal.aborted || Player.song?.id !== song.id) return;

    Player.preview = preview;
    if (!preview?.preview) {
      Player.audioStatus = "unavailable";
      dispatchPlayerChange();
      toast("No hay una muestra disponible para esta canción");
      return;
    }

    Player.audio.src = preview.preview;
    Player.audio.volume = Player.volume;
    Player.audio.load();
    Player.audioStatus = "ready";
    Player.duration = 30;
    dispatchPlayerChange();
    startPreviewPlayback();
  } catch (error) {
    if (controller.signal.aborted) return;
    console.error("No se pudo cargar la muestra de iTunes:", error);
    Player.audioStatus = "error";
    Player.playing = false;
    dispatchPlayerChange();
    toast("No se pudo cargar la muestra. Inténtalo de nuevo.");
  }
}

function startPreviewPlayback() {
  try {
    const playback = Player.audio.play();
    if (playback?.catch) {
      playback.catch(error => {
        if (error.name === "NotAllowedError") {
          Player.audioStatus = "ready";
          Player.playing = false;
          dispatchPlayerChange();
          toast("La muestra está lista. Pulsa reproducir para escucharla.");
          return;
        }
        console.error("No se pudo reproducir la muestra:", error);
        Player.audioStatus = "error";
        Player.playing = false;
        dispatchPlayerChange();
        toast("No se pudo reproducir la muestra.");
      });
    }
  } catch (error) {
    console.error("No se pudo iniciar la muestra:", error);
    Player.audioStatus = "error";
    Player.playing = false;
    dispatchPlayerChange();
    toast("No se pudo reproducir la muestra.");
  }
}

/* ─── play song ─── */
function playSong(songId, queueIds, contextType, contextId, contextLabel) {
  const song = DB.song(songId);
  if (!song) return;

  Player.queue = queueIds && queueIds.length ? [...queueIds] : [songId];
  Player.index = Player.queue.indexOf(songId);
  if (Player.index < 0) { Player.queue.unshift(songId); Player.index = 0; }

  Player.context = { type: contextType || "", id: contextId || "", label: contextLabel || "" };
  Player.song = song;
  loadTrackPreview();
}

function playCollection(type, id) {
  let ids = [];
  let label = "";
  if (type === "playlist") {
    const p = DB.playlist(id);
    if (!p) return;
    ids = [...p.songIds];
    label = p.name;
  } else if (type === "album") {
    const a = DB.album(id);
    if (!a) return;
    ids = a.songs.map(s => s[0]);
    label = a.title;
  } else if (type === "artist") {
    const a = DB.artist(id);
    if (!a) return;
    const albums = DB.albums.filter(al => al.artistId === id);
    ids = albums.flatMap(al => al.songs.map(s => s[0]));
    label = a.name;
  } else if (type === "liked") {
    ids = [...Player.liked];
    label = "Canciones que te gustan";
  }
  if (!ids.length) { toast("Esta colección no tiene canciones"); return; }
  playSong(ids[0], ids, type, id, label);
}

function shuffleCollection(type, id) {
  let ids = [];
  let label = "";
  if (type === "playlist") {
    const p = DB.playlist(id);
    ids = [...(p?.songIds || [])];
    label = p?.name || "";
  } else if (type === "album") {
    const a = DB.album(id);
    ids = a?.songs.map(s => s[0]) || [];
    label = a?.title || "";
  } else if (type === "artist") {
    const a = DB.artist(id);
    const albums = DB.albums.filter(al => al.artistId === id);
    ids = albums.flatMap(al => al.songs.map(s => s[0]));
    label = a?.name || "";
  } else if (type === "liked") {
    ids = [...Player.liked];
    label = "Canciones que te gustan";
  }
  if (!ids.length) { toast("Sin canciones"); return; }
  const shuffled = [...ids].sort(() => Math.random() - 0.5);
  Player.shuffle = true;
  playSong(shuffled[0], shuffled, type, id, label);
}

/* ─── controls ─── */
function togglePlay() {
  if (!Player.song) { toast("Elige una canción primero"); return; }
  if (Player.audioStatus === "loading") {
    toast("Buscando una muestra de audio…");
    return;
  }
  if (Player.audioStatus !== "ready") {
    loadTrackPreview();
    return;
  }
  if (Player.playing) Player.audio.pause();
  else startPreviewPlayback();
}

function playNext() {
  if (!Player.queue.length) return;
  let next = Player.index + 1;
  if (next >= Player.queue.length) {
    if (Player.repeat === "all") next = 0;
    else {
      Player.audio.pause();
      Player.playing = false;
      Player.currentTime = Player.duration;
      dispatchPlayerChange();
      return;
    }
  }
  const song = DB.song(Player.queue[next]);
  if (!song) return;
  playSong(song.id, Player.queue, Player.context.type, Player.context.id, Player.context.label);
}

function playPrev() {
  if (Player.currentTime > 3) {
    if (Player.audioStatus === "ready") Player.audio.currentTime = 0;
    Player.currentTime = 0;
    dispatchPlayerChange();
    return;
  }
  if (!Player.queue.length) return;
  let prev = Player.index - 1;
  if (prev < 0) prev = Player.repeat === "all" ? Player.queue.length - 1 : 0;
  const song = DB.song(Player.queue[prev]);
  if (!song) return;
  playSong(song.id, Player.queue, Player.context.type, Player.context.id, Player.context.label);
}

function toggleRepeat() {
  const map = { none: "all", all: "one", one: "none" };
  Player.repeat = map[Player.repeat] || "none";
  dispatchPlayerChange();
}

function toggleShuffle() {
  Player.shuffle = !Player.shuffle;
  if (Player.shuffle && Player.queue.length > 1) {
    const cur = Player.queue[Player.index];
    const rest = Player.queue.filter(id => id !== cur).sort(() => Math.random() - 0.5);
    Player.queue = [cur, ...rest];
    Player.index = 0;
  }
  dispatchPlayerChange();
}

function seekTo(t) {
  Player.currentTime = Math.max(0, Math.min(t, Player.duration));
  if (Player.audioStatus === "ready" && Player.audio.readyState > 0) {
    Player.audio.currentTime = Player.currentTime;
  }
  dispatchPlayerChange();
}

function setVolume(v) {
  Player.volume = Math.max(0, Math.min(1, v));
  Player.audio.volume = Player.volume;
  dispatchPlayerChange();
}

function toggleLike(songId) {
  if (Player.liked.has(songId)) Player.liked.delete(songId);
  else Player.liked.add(songId);
  Store.set("liked", [...Player.liked]);
  dispatchPlayerChange();
}

function toggleMute() {
  if (Player.volume > 0) {
    Player._prevVol = Player.volume;
    setVolume(0);
  } else {
    setVolume(Player._prevVol || 0.7);
  }
}

/* ─── timer ─── */
let _lastTick = Date.now();
function tick() {
  const now = Date.now();
  const delta = (now - _lastTick) / 1000;
  _lastTick = now;
  if (!Player.playing || !Player.song) return;
  if (Player.preview) {
    Player.currentTime = Player.audio.currentTime;
    updateProgressUI();
    return;
  }
  Player.currentTime = Math.min(Player.currentTime + delta, Player.duration);
  if (Player.currentTime >= Player.duration) {
    if (Player.repeat === "one") Player.currentTime = 0;
    else playNext();
  }
  updateProgressUI();
}

/* ─── saved artists / albums ─── */
function toggleSaveArtist(id) {
  const saved = new Set(Store.get("savedArtists") || []);
  if (saved.has(id)) { saved.delete(id); toast("Dejaste de seguir al artista"); }
  else { saved.add(id); toast("Siguiendo al artista"); }
  Store.set("savedArtists", [...saved]);
  dispatchPlayerChange();
}

function toggleSaveAlbum(id) {
  const saved = new Set(Store.get("savedAlbums") || []);
  if (saved.has(id)) { saved.delete(id); toast("Álbum eliminado de tu biblioteca"); }
  else { saved.add(id); toast("Álbum guardado en tu biblioteca"); }
  Store.set("savedAlbums", [...saved]);
  dispatchPlayerChange();
}

/* ─── init ─── */
restorePlayerState();
Player.audio.volume = Player.volume;
Player.audio.addEventListener("loadedmetadata", () => {
  if (!Player.preview || !Number.isFinite(Player.audio.duration)) return;
  Player.duration = Player.audio.duration;
  updateProgressUI();
  dispatchPlayerChange();
});
Player.audio.addEventListener("timeupdate", () => {
  if (!Player.preview) return;
  Player.currentTime = Player.audio.currentTime;
  updateProgressUI();
});
Player.audio.addEventListener("play", () => {
  if (!Player.preview) return;
  Player.playing = true;
  dispatchPlayerChange();
});
Player.audio.addEventListener("pause", () => {
  if (!Player.preview || !Player.playing) return;
  Player.playing = false;
  dispatchPlayerChange();
});
Player.audio.addEventListener("ended", () => {
  if (!Player.preview) return;
  if (Player.repeat === "one") {
    Player.audio.currentTime = 0;
    startPreviewPlayback();
  } else {
    playNext();
  }
});
Player.audio.addEventListener("error", () => {
  if (!Player.preview) return;
  Player.audioStatus = "error";
  Player.playing = false;
  dispatchPlayerChange();
  toast("La muestra de audio no está disponible.");
});
_lastTick = Date.now();
setInterval(tick, 250);

// Guarda el avance aunque el usuario no interactúe.
setInterval(() => { if (Player.song) savePlayerState(); }, 4000);
window.addEventListener("pagehide", savePlayerState);
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") savePlayerState();
});
