// Characters: pictures to reference (any number), the words that describe the character, and how strongly generations
// follow the pictures. Applying one sets up reference images (IP-Adapter) and the prompt words; see
// features/params/characters.
import { createPresetStore } from './presets/presetStore';

export interface CharacterData {
  /** The gallery pictures used as references, in order (ideally the character on a plain white background). */
  imageNames: string[];
  /** How strongly the references are followed together; each reference image gets its share (`referenceWeight`). */
  weight: number;
  /** Words that describe what must not change (hair and eye colour, clothes), put in front of the prompt. */
  tags: string;
  /** A LoRA the character is used with; used next to the reference pictures. */
  lora?: CharacterLora;
}

export interface CharacterLora {
  /** The LoRA's model key. */
  key: string;
  weight: number;
  /** The word that calls the character up, put in front of the prompt with the look words. */
  trigger: string;
  /** Off: using the character leaves the LoRA out (the reference pictures still apply). */
  enabled: boolean;
}

/** Strong enough to bring the character in, with room for the prompt and the reference pictures. */
export const DEFAULT_LORA_WEIGHT = 0.8;

/** Strong enough to keep the look of the character, loose enough for a new scene. */
export const DEFAULT_CHARACTER_WEIGHT = 0.6;

/**
 * Above this CFG scale a picture made with a reference image comes out burnt (oversaturated, hard edges); checked on a
 * real engine at 7 against 4. Using a character lowers a higher scale to `CHARACTER_CFG`.
 */
export const CHARACTER_MAX_CFG = 5;
export const CHARACTER_CFG = 4.5;

/**
 * Reference images that can be used at once; mirrors the backend's limit (`MAX_REF_IMAGES` in novira-core
 * `service/guidance.rs`). A character may hold more pictures; its first ones are used.
 */
export const MAX_REFERENCE_IMAGES = 8;

/**
 * The weight of each reference image when a character uses `count` of them: every reference adds its own pull, so the
 * share shrinks with the square root of the count to keep the total near the character's weight.
 */
export function referenceWeight(weight: number, count: number): number {
  return Math.round((weight / Math.sqrt(Math.max(1, count))) * 100) / 100;
}

/** A stored LoRA entry as it should be, or undefined when it is missing or broken. */
function storedLora(value: unknown): CharacterLora | undefined {
  const l = value as Partial<CharacterLora> | null | undefined;
  if (!l || typeof l.key !== 'string' || !l.key) return undefined;
  return {
    key: l.key,
    weight: typeof l.weight === 'number' && Number.isFinite(l.weight) ? l.weight : DEFAULT_LORA_WEIGHT,
    trigger: typeof l.trigger === 'string' ? l.trigger : '',
    enabled: l.enabled !== false,
  };
}

/**
 * Version 3 may hold a LoRA (`lora`); version 2 holds a list of pictures; version 1 held one `imageName`.
 * Older data is brought up to date, and a broken LoRA entry is dropped.
 */
export function migrateCharacters<S extends { presets?: { data: CharacterData }[] }>(stored: S): S {
  return {
    ...stored,
    presets: (stored.presets ?? []).map((p) => {
      const old = p.data as unknown as { imageName?: string; imageNames?: string[]; lora?: unknown };
      const { imageName, lora, ...rest } = old;
      const imageNames = old.imageNames ?? (imageName ? [imageName] : []);
      const kept = storedLora(lora);
      return { ...p, data: { ...rest, imageNames, ...(kept ? { lora: kept } : {}) } as CharacterData };
    }),
  };
}

export const useCharacters = createPresetStore<CharacterData>({ name: 'novira.characters', seed: [], version: 3, migrate: (stored) => migrateCharacters(stored as never) });
