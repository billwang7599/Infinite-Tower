import type { SavedSettings } from "@infinite-tower/shared";
import { Store } from "../ui/store.js";
import { savedOnSlider, snapToSlider } from "./slider.js";

type SavedAudio = SavedSettings["audio"];

export const VOLUMES = ["master", "effects", "ambient", "music"] as const;
export type VolumeName = (typeof VOLUMES)[number];
export type Volumes = Record<VolumeName, number>;

export const VOLUME = { min: 0, max: 1, step: 0.05, defaults: { master: 0.8, effects: 1, ambient: 1, music: 1 } as Volumes } as const;

export class AudioSettings extends Store<Volumes> {
  constructor() {
    super({ ...VOLUME.defaults });
  }

  restore(saved: SavedAudio): void {
    const read = (name: VolumeName) => savedOnSlider(VOLUME, saved?.[name], VOLUME.defaults[name]);
    this.set(Object.fromEntries(VOLUMES.map((v) => [v, read(v)])) as Volumes);
  }

  toSaved(): NonNullable<SavedAudio> {
    return Object.fromEntries(VOLUMES.filter((v) => !this.isDefault(v)).map((v) => [v, this.get()[v]]));
  }

  setVolume(name: VolumeName, value: number): void {
    this.set({ [name]: snapToSlider(VOLUME, value) });
  }

  isDefault(name: VolumeName): boolean {
    return this.get()[name] === VOLUME.defaults[name];
  }
}
