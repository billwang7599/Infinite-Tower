export interface Tab<Id extends string> {
  id: Id;
  name: string;
}

export const CHARACTER_TABS = [
  { id: "stats", name: "Stats" },
  { id: "core", name: "Core" },
  { id: "relationships", name: "Relationships" },
] as const satisfies readonly Tab<string>[];
export type CharacterTab = (typeof CHARACTER_TABS)[number]["id"];

export const STAT_TABS = [
  { id: "basic", name: "Basic" },
  { id: "advanced", name: "Advanced" },
] as const satisfies readonly Tab<string>[];
export type StatTab = (typeof STAT_TABS)[number]["id"];

export const RELATIONSHIP_TABS = [
  { id: "gods", name: "Gods" },
] as const satisfies readonly Tab<string>[];
export type RelationshipTab = (typeof RELATIONSHIP_TABS)[number]["id"];
