import { clamp, roundTo, type SavedSettings } from "@infinite-tower/shared";
import { Store } from "../ui/store.js";

type SavedAudio = SavedSettings["audio"];

export const VOLUMES = ["master", "effects", "ambient", "music"] as const;
export type VolumeName = (typeof VOLUMES)[number];
export type Volumes = Record<VolumeName, number>;

export const VOLUME = { step: 0.05, defaults: { master: 0.8, effects: 1, ambient: 1, music: 1 } as Volumes } as const;

export class AudioSettings extends Store<Volumes> {
  constructor() {
    super({ ...VOLUME.defaults });
  }

  restore(saved: SavedAudio): void {
    const read = (name: VolumeName) => {
      const value = saved?.[name];
      return typeof value === "number" && value >= 0 && value <= 1 ? value : VOLUME.defaults[name];
    };
    this.set(Object.fromEntries(VOLUMES.map((v) => [v, read(v)])) as Volumes);
  }

  toSaved(): NonNullable<SavedAudio> {
    return Object.fromEntries(VOLUMES.filter((v) => !this.isDefault(v)).map((v) => [v, this.get()[v]]));
  }

  setVolume(name: VolumeName, value: number): void {
    this.set({ [name]: clamp(roundTo(Math.round(value / VOLUME.step) * VOLUME.step, 2), 0, 1) });
  }

  isDefault(name: VolumeName): boolean {
    return this.get()[name] === VOLUME.defaults[name];
  }
}
