// Uses a saved character for the next generations: its pictures become reference images and its words go in front of
// the positive prompt. A character with a LoRA (switched on) also adds that LoRA and its trigger word.
import { t } from '@/i18n';
import { CHARACTER_CFG, CHARACTER_MAX_CFG, MAX_REFERENCE_IMAGES, referenceWeight, useCharacters } from '@/state/characters';
import { findImage } from '@/state/gallery';
import { defaultRefModelKey, findModel } from '@/state/models';
import { useParams } from '@/state/params';
import { toast } from '@/state/toasts';
import { getPrompt, setPrompt } from '../prompts/promptActions';
import { withTagsFirst } from '@/state/prompts/promptTags';

export interface AppliedCharacter {
  /** Whether the CFG scale had to be lowered because references make pictures burn at a high one. */
  cfgLowered: boolean;
  /** How many reference images the character set up. */
  used: number;
  /** Pictures left out because the reference images were full. */
  capped: number;
  /** Pictures of the character that are no longer in the gallery. */
  missing: number;
  /** The character's LoRA: added, switched off, no longer installed, or none. */
  lora: 'used' | 'off' | 'gone' | 'none';
}

/** Null when the character has no picture left (the reason is shown as a notification). */
export function applyCharacter(id: string): AppliedCharacter | null {
  const character = useCharacters.getState().presets.find((p) => p.id === id);
  if (!character) return null;
  const found = character.data.imageNames.flatMap((name) => {
    const image = findImage(name);
    return image ? [image] : [];
  });
  const missing = character.data.imageNames.length - found.length;
  if (!found.length) {
    toast({ status: 'error', title: t('character.missingImage', { name: character.name }) });
    return null;
  }
  const params = useParams.getState();
  // The references the character does not own take their places first; the character fills the rest.
  const others = params.refImages.filter((r) => !found.some((i) => i.name === r.imageName)).length;
  const room = Math.max(0, MAX_REFERENCE_IMAGES - others);
  const chosen = found.slice(0, room);
  if (!chosen.length) {
    toast({ status: 'error', title: t('character.refsFull', { max: MAX_REFERENCE_IMAGES }) });
    return null;
  }
  const weight = referenceWeight(character.data.weight, chosen.length);
  for (const image of chosen) {
    const existing = useParams.getState().refImages.find((r) => r.imageName === image.name);
    if (existing) params.updateRefImage(existing.id, { isEnabled: true, weight });
    else params.addRefImage({ imageName: image.name, imageUrl: image.url, weight, modelKey: defaultRefModelKey(params.modelKey) });
  }
  const lora = character.data.lora;
  const loraState: AppliedCharacter['lora'] = !lora ? 'none' : !lora.enabled ? 'off' : findModel(lora.key) ? 'used' : 'gone';
  if (lora && loraState === 'used') {
    params.addLora(lora.key);
    useParams.getState().updateLora(lora.key, { weight: lora.weight, isEnabled: true });
  }
  const words = [loraState === 'used' ? lora!.trigger : '', character.data.tags].filter((w) => w.trim()).join(', ');
  if (words) setPrompt('positive', withTagsFirst(getPrompt('positive'), words));
  const cfgLowered = params.cfgScale > CHARACTER_MAX_CFG;
  if (cfgLowered) params.set({ cfgScale: CHARACTER_CFG });
  useCharacters.getState().select(id);
  return { cfgLowered, used: chosen.length, capped: found.length - chosen.length, missing, lora: loraState };
}
