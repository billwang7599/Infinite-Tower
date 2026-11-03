import type { Mode } from "../game/transition.js";
import type { BattleContext } from "../modes/battle/context.js";
import type { OverworldState } from "../modes/overworld/components.js";
import type { AudioSettings } from "../settings/audio.js";
import type { Notifications } from "../ui/notifications/state.js";
import { fightEars, type Cue, type Heard } from "./battle.js";
import { mixGain, place } from "./mix.js";
import { MUSIC, musicFor, TRACKS, type TrackName } from "./music.js";
import { overworldEars, themeHere } from "./overworld.js";
import { EVENT_SOUNDS, soundDef, take, type SoundName } from "./sounds.js";

const URLS = import.meta.glob<string>("./sounds/*.ogg", { eager: true, query: "?url", import: "default" });
const MUSIC_URLS = import.meta.glob<string>("./music/*.ogg", { eager: true, query: "?url", import: "default" });
// Of one sound at once: a burst of split Bolts shouldn't stack sixteen impacts.
const MAX_VOICES = 4;
const LOOP_EASE_TIME = 0.1;
const LOOP_STOP_TIME = 0.5;
const MUSIC_FADE_TIME = 1.5;
const DEBUG_LOG_LENGTH = 50;

export interface Audio {
  // Call on a user gesture: browsers only let sound start after one.
  unlock(): void;
  play(sound: SoundName): void;
  // null is the title: no sounds, the title's music.
  frame(mode: Mode | null): void;
  debug(): {
    context: AudioContextState | null; loaded: number; loops: string[]; played: string[]; music: TrackName | null;
  };
}

interface AudioParts {
  volumes: AudioSettings;
  notifications: Notifications;
  battle: BattleContext;
  overworld: OverworldState;
}

interface Voice { sound: SoundName; src: AudioBufferSourceNode; gain: GainNode; pan: StereoPannerNode; own: number }

interface Music { track: TrackName; gain: GainNode; src: AudioBufferSourceNode | null }

const decode = (c: AudioContext, url: string): Promise<AudioBuffer> =>
  fetch(url).then((r) => r.arrayBuffer()).then((data) => c.decodeAudioData(data));

export function createAudio({ volumes, notifications, battle, overworld }: AudioParts): Audio {
  let ctx: AudioContext | null = null, out: AudioNode | null = null;
  const buffers = new Map<string, AudioBuffer>(), voices = new Map<SoundName, number>();
  const lastVariant = new Map<SoundName, number>(), loops = new Map<string, Voice>(), played: string[] = [];
  const hearFight = fightEars(), hearOverworld = overworldEars();
  let wantedMusic: TrackName | null = MUSIC.title, music: Music | null = null;

  const load = (c: AudioContext) => {
    for (const [path, url] of Object.entries(URLS)) {
      const file = path.slice(path.lastIndexOf("/") + 1);
      decode(c, url).then(
        (buffer) => buffers.set(file, buffer),
        (err: unknown) => console.warn(`Sound ${file} didn't load`, err),
      );
    }
  };

  const start = (cue: Cue, gain: number, pan: number, loop: boolean): Voice | null => {
    if (!ctx || !out || ctx.state !== "running") return null;
    const count = voices.get(cue.sound) ?? 0;
    if (!loop && count >= MAX_VOICES) return null;
    const t = take(cue.sound, lastVariant.get(cue.sound), Math.random), buffer = buffers.get(t.file);
    if (!buffer) return null;
    lastVariant.set(cue.sound, t.variant);
    const src = ctx.createBufferSource(), gainNode = ctx.createGain(), panNode = ctx.createStereoPanner();
    src.buffer = buffer;
    src.loop = loop;
    src.playbackRate.value = t.rate * (cue.rate ?? 1);
    const own = t.gain * (cue.gain ?? 1);
    gainNode.gain.value = loop ? 0 : mixGain(volumes.get(), soundDef(cue.sound).bus ?? "effects", own, gain);
    panNode.pan.value = pan;
    src.connect(gainNode).connect(panNode).connect(out);
    voices.set(cue.sound, count + 1);
    src.onended = () => voices.set(cue.sound, (voices.get(cue.sound) ?? 1) - 1);
    src.start(0, loop ? Math.random() * buffer.duration : 0);
    played.push(cue.sound);
    if (played.length > DEBUG_LOG_LENGTH) played.shift();
    return { sound: cue.sound, src, gain: gainNode, pan: panNode, own };
  };

  const stopLoop = (key: string) => {
    const voice = loops.get(key);
    if (!voice || !ctx) return;
    voice.gain.gain.setTargetAtTime(0, ctx.currentTime, LOOP_STOP_TIME / 4);
    voice.src.stop(ctx.currentTime + LOOP_STOP_TIME);
    loops.delete(key);
  };

  const render = (heard: Heard | null) => {
    for (const cue of heard?.cues ?? []) {
      const { gain, pan } = place(heard!.ears, cue.at, heard!.hearing, soundDef(cue.sound).reach);
      if (gain > 0) start(cue, gain, pan, false);
    }
    const wanted = heard?.loops ?? new Map<string, Cue>();
    for (const key of [...loops.keys()]) if (loops.get(key)!.sound !== wanted.get(key)?.sound) stopLoop(key);
    for (const [key, cue] of wanted) {
      const def = soundDef(cue.sound), { gain, pan } = place(heard!.ears, cue.at, heard!.hearing, def.reach);
      const voice = loops.get(key) ?? start(cue, gain, pan, true);
      if (!voice || !ctx) continue;
      loops.set(key, voice);
      voice.gain.gain.setTargetAtTime(mixGain(volumes.get(), def.bus ?? "effects", voice.own, gain), ctx.currentTime,
        LOOP_EASE_TIME);
      voice.pan.pan.setTargetAtTime(pan, ctx.currentTime, LOOP_EASE_TIME);
    }
  };

  const play = (sound: SoundName) => start({ sound, at: null }, 1, 0, false);

  const musicGain = (track: TrackName) => mixGain(volumes.get(), "music", TRACKS[track].volume);

  // Decoded only while it plays: a couple of minutes of music is tens of MB decoded, a fraction of that fetched.
  const playMusic = (track: TrackName | null) => {
    wantedMusic = track;
    if (!ctx || !out || music?.track === track) return;
    const c = ctx, now = c.currentTime;
    if (music?.src) {
      music.gain.gain.setTargetAtTime(0, now, MUSIC_FADE_TIME / 4);
      music.src.stop(now + MUSIC_FADE_TIME);
    } else music?.gain.disconnect();
    music = null;
    if (!track) return;
    const playing: Music = { track, gain: c.createGain(), src: null };
    playing.gain.gain.value = 0;
    playing.gain.connect(out);
    music = playing;
    decode(c, MUSIC_URLS[`./music/${track}.ogg`]!).then(
      (buffer) => {
        if (music !== playing) return;
        const src = c.createBufferSource();
        src.buffer = buffer;
        src.loop = true;
        src.connect(playing.gain);
        src.onended = () => playing.gain.disconnect();
        src.start();
        playing.src = src;
        playing.gain.gain.setTargetAtTime(musicGain(track), c.currentTime, MUSIC_FADE_TIME / 4);
      },
      (err: unknown) => console.warn(`Music ${track} didn't load`, err),
    );
  };

  const unlock = () => {
    if (!ctx) {
      ctx = new AudioContext();
      const limiter = ctx.createDynamicsCompressor();
      limiter.threshold.value = -6;
      limiter.ratio.value = 8;
      limiter.connect(ctx.destination);
      out = limiter;
      load(ctx);
      playMusic(wantedMusic);
    }
    if (ctx.state === "suspended") void ctx.resume();
  };

  document.addEventListener("pointerdown", unlock);
  document.addEventListener("click", (e) => {
    if (e.target instanceof Element && e.target.closest("button, [role=button], input[type=checkbox], select")) {
      play("click");
    }
  });
  notifications.said.subscribe(() => {
    const event = notifications.said.get().event, sound = event && EVENT_SOUNDS[event.kind];
    if (sound) play(sound);
  });
  volumes.subscribe(() => {
    if (ctx && music?.src) music.gain.gain.setTargetAtTime(musicGain(music.track), ctx.currentTime, LOOP_EASE_TIME);
  });

  return {
    unlock,
    play,
    frame(mode) {
      render(mode === "battle" ? hearFight(battle) : mode === "overworld" ? hearOverworld(overworld) : null);
      playMusic(musicFor({
        mode, region: themeHere(overworld), arena: battle.fight?.arena.look ?? null,
        decided: battle.outcome.state !== "fighting",
      }));
    },
    debug: () => ({
      context: ctx?.state ?? null, loaded: buffers.size, loops: [...loops.values()].map((v) => v.sound),
      played: [...played], music: music?.src ? music.track : null,
    }),
  };
}
