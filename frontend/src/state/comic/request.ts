// The queue request that draws one comic panel: the Generate tab's settings (model, LoRAs, VAE, reference images, hires fix
// and the rest), the panel's own prompts and shape, and the panel's pose (and its 3D rough's depth map) as control layers
// when a model that reads them is installed.
// The picture goes to the gallery. A panel is drawn from its own prompts only: on the comic screen the prompt boxes edit
// the selected panel's prompts (see promptSync.ts).
import { randomSeed, type ControlLayerInput, type EnqueueRequest, type GenerationMetadata, type RefImageInput, type RegionalLayerInput } from '@/backend';
import { t } from '@/i18n';
import { modelPartsReason } from '@/state/modelParts';
import { refImagesEncoderReason, refImagesPackReason } from '@/state/comfy/packNeeds';
import { CHARACTER_CFG, CHARACTER_MAX_CFG, MAX_REFERENCE_IMAGES, referenceWeight, useCharacters, type CharacterLora } from '@/state/characters';
import { txt2imgParts } from '@/state/generationParts';
import { findImage } from '@/state/gallery';
import { autoAddBoardId } from '@/state/invoke';
import { defaultRefModelKey, findModel, useModels } from '@/state/models';
import { useParams, type DynamicPromptMode } from '@/state/params';
import { DEPTH_CONTROL, POSE_CONTROL, pickDepthModel, pickPoseModel } from '@/state/poseSkeleton';
import { expandPrompt, hasDynamicSyntax, randomPrompt } from '@/state/prompts/dynamicPrompts';
import { useWildcards, wildcardMap } from '@/state/prompts/wildcards';
import { castRegions, storeCastRegions, type StoredRegion } from './castRegions';
import { allWords, characterWords, framingOf } from './characterLook';
import { referencePicture } from './characterSheet';
import { pageAspect, panelGeometry, panelPixels } from './layout';
import { withPageDraw } from './drawSync';
import { activePage, activeProject, useComic, findPanel, workPanel, type PanelRef } from './store';
import { styleOf } from './style';
import { CAST_REFERENCE_END, CHARACTER_REF_WEIGHT, type ComicCharacter, type ComicPanel, type ComicPlace, type ComicProject, type SheetView } from './document';

/** The words of the characters that are in the panel, in the cast's order: the tags and the parts the panel's framing shows. */
export function castTags(project: Pick<ComicProject, 'cast'>, panel: Pick<ComicPanel, 'cast' | 'prompt'>): string {
  return project.cast
    .filter((c) => panel.cast.includes(c.id))
    .map((c) => characterWords(c, panel.prompt))
    .filter(Boolean)
    .join(', ');
}

/** The place a panel is set in, when it names one the comic still has. */
export function panelPlace(project: Pick<ComicProject, 'places'>, panel: Pick<ComicPanel, 'place'>): ComicPlace | undefined {
  return panel.place ? project.places.find((p) => p.id === panel.place) : undefined;
}

/**
 * How strongly a close-up takes its place's words. At full strength the list of what a room holds took the frame from the
 * subject: on 2026-10-15 (WAI-illustrious-SDXL v1.7, a pose ControlNet, CFG 6) a close-up of a hand came out as the empty
 * room on 3 of 3 seeds and a face close-up as a wider shot; at 0.7 both kept their framing, at 0.5 the place drifted away.
 */
export const CLOSE_PLACE_WEIGHT = 0.7;

/**
 * The words of where a panel is: its place's, then the comic's world, so the panels of one place share a background and
 * every place one world. They follow the panel's own words: the people and what they do come first, as a tag prompt orders
 * them. A close-up takes its place's words more weakly (`CLOSE_PLACE_WEIGHT`), so the room does not crowd out the subject.
 */
export function settingWords(project: Pick<ComicProject, 'places' | 'world'>, panel: Pick<ComicPanel, 'place' | 'prompt'>): string {
  const tags = panelPlace(project, panel)?.tags.trim();
  const place = tags && framingOf(panel.prompt) === 'close' ? `(${tags}:${CLOSE_PLACE_WEIGHT})` : tags;
  return [place, project.world?.trim()].filter(Boolean).join(', ');
}

/**
 * The negative prompt of a panel: its own, what its place keeps out, then what each character in it keeps out. A character
 * drawn in a region of its own keeps its negative to that region (see regionLayers), so it is left out here.
 */
export function panelNegative(project: Pick<ComicProject, 'cast' | 'places'>, panel: Pick<ComicPanel, 'cast' | 'negativePrompt' | 'place'>, regions?: StoredRegion[]): string {
  const apart = new Set((regions ?? []).map((r) => r.character.id));
  const theirs = project.cast.filter((c) => panel.cast.includes(c.id) && !apart.has(c.id)).map((c) => c.negative?.trim());
  return [panel.negativePrompt.trim(), panelPlace(project, panel)?.negative?.trim(), ...theirs].filter(Boolean).join(', ');
}

/**
 * The positive prompt a panel is drawn from, before dynamic prompt syntax is expanded: the words of its characters (so
 * each looks the same in every panel) in front of the panel's own prompt, and the words of its place and world behind it.
 */
function panelTemplate(panel: ComicPanel, project: Pick<ComicProject, 'cast' | 'places' | 'world'>, regions?: StoredRegion[]): string {
  // Drawn in regions, each character's words go with its region instead.
  const cast = regions?.length ? '' : castTags(project, panel);
  return [cast, panel.prompt.trim(), settingWords(project, panel)].filter(Boolean).join(', ');
}

/**
 * The template a panel is drawn from, before dynamic prompt syntax is expanded: the style's words, the trigger word of the
 * character LoRA the panel uses, then the panel's own words. It is read with the page's settings in the form (see withPageDraw),
 * as the style and the LoRA depend on the model. The one source of the draw, of its other combinations and of the warning.
 */
function drawTemplate(ref: PanelRef, regions?: StoredRegion[]): string {
  const style = styleOf(ref.project, ref.project.pages[ref.pageIndex], findModel(useParams.getState().modelKey)?.base ?? null);
  const lora = castLora(ref.panel, ref.project);
  return [style.positive, lora?.trigger.trim(), panelTemplate(ref.panel, ref.project, regions)].filter(Boolean).join(', ');
}

/**
 * The prompt one panel picture is drawn with. Dynamic prompt syntax works as it does on Generate, but a panel is one
 * picture: the random mode picks the combination its seed picks, and the combinations mode takes the first one.
 */
function panelPrompt(template: string, seed: number, mode: DynamicPromptMode): string {
  if (!hasDynamicSyntax(template)) return template;
  const lists = wildcardMap(useWildcards.getState().lists);
  if (mode === 'random') return randomPrompt(template, lists, seed);
  return expandPrompt(template, undefined, lists)[0] ?? '';
}

/** The pose model for a panel's pose, or null when the panel has no pose or the model is not installed. */
function poseModelKey(): string | null {
  const mainBase = findModel(useParams.getState().modelKey)?.base ?? null;
  return pickPoseModel(useModels.getState().models, mainBase)?.key ?? null;
}

/** Whether a pose model is installed for the chosen main model, so a panel's pose reaches its picture. */
export const poseModelReady = (): boolean => poseModelKey() !== null;

/** The depth model for a panel's 3D rough, or null when none is installed for the main model. */
function depthModelKey(): string | null {
  const mainBase = findModel(useParams.getState().modelKey)?.base ?? null;
  return pickDepthModel(useModels.getState().models, mainBase)?.key ?? null;
}

/** The pose picture as a control layer, when the panel has one and the pose model is installed. */
function poseControl(panel: ComicPanel): ControlLayerInput[] {
  if (!panel.poseImageName) return [];
  const url = findImage(panel.poseImageName)?.url;
  const modelKey = poseModelKey();
  if (!url || !modelKey) return [];
  // Told it is a pose, a union ControlNet reads the stick figure as a body, not as lines to draw.
  return [{ imageUrl: url, modelKey, weight: POSE_CONTROL.weight, beginEnd: [...POSE_CONTROL.beginEnd], controlMode: 'balanced', controlType: 'openpose' }];
}

/**
 * Whether the panel's 3D rough was baked for another shape of panel: its depth map's sides do not keep the panel's
 * proportion (more than 2 % apart) since the page's cut or size changed. The engine would stretch the set out of place, so
 * the depth map is left out and the panel says to bake the rough again.
 */
export function roughOutOfShape(panel: Pick<ComicPanel, 'depthImageName'>, size: { width: number; height: number }): boolean {
  const picture = panel.depthImageName ? findImage(panel.depthImageName) : undefined;
  if (!picture?.width || !picture.height) return false;
  const want = size.width / size.height;
  return Math.abs(picture.width / picture.height - want) / want > 0.02;
}

/** The size in pixels a panel is drawn at. */
function panelSize(ref: PanelRef): { width: number; height: number } {
  const page = ref.project.pages[ref.pageIndex];
  const box = page ? panelGeometry(page)[ref.panelIndex]?.box : undefined;
  return box ? panelPixels(box, pageAspect(page?.size)) : { width: 1024, height: 1024 };
}

/**
 * The depth map of the panel's 3D rough as a control layer, when it has one and a depth model is installed: lightly and over
 * the first half of the steps, so it places the set and the people's bulk while the pose and the words draw them.
 */
function depthControl(panel: ComicPanel, size: { width: number; height: number }): ControlLayerInput[] {
  if (!panel.depthImageName || roughOutOfShape(panel, size)) return [];
  const url = findImage(panel.depthImageName)?.url;
  const modelKey = depthModelKey();
  if (!url || !modelKey) return [];
  return [{ imageUrl: url, modelKey, weight: DEPTH_CONTROL.weight, beginEnd: [...DEPTH_CONTROL.beginEnd], controlMode: 'balanced', controlType: 'depth' }];
}

/**
 * The characters of the panel that have a reference picture still in the gallery, other than the panel's own picture: the
 * view of its sheet the panel's framing needs (see characterSheet.ts), or the front when the sheet lacks it.
 */
function referencedCast(panel: ComicPanel, project: Pick<ComicProject, 'cast'>): { character: ComicCharacter; url: string }[] {
  return project.cast.flatMap((character) => {
    if (!panel.cast.includes(character.id)) return [];
    const url = [referencePicture(character, panel.prompt), character.imageName]
      .filter((name): name is string => !!name && name !== panel.imageName)
      .map((name) => findImage(name)?.url)
      .find(Boolean);
    return url ? [{ character, url }] : [];
  });
}

/** The most pictures a model takes in itself as references at once (the backend's MAX_REFERENCE_PICTURES). */
export const MAX_REFERENCE_PICTURES = 4;

/** Whether the main model takes pictures in itself as references (FLUX.2), instead of through an IP-Adapter. */
export function takesReferencePictures(): boolean {
  return findModel(useParams.getState().modelKey)?.base === 'flux2';
}

/**
 * Whether a comic's panels are drawn with their characters' pictures: by a model that takes them in itself (FLUX.2), or
 * through an installed IP-Adapter when the comic turns its character references on. Only then is a character's
 * missing picture drawn before its panels.
 */
export function usesCastPictures(project: Pick<ComicProject, 'castReference'>): boolean {
  return takesReferencePictures() || (project.castReference !== undefined && defaultRefModelKey(useParams.getState().modelKey) !== null);
}

/** The characters' pictures a panel gives a model that takes them in itself: the same pictures as its references. */
export function castPictures(panel: ComicPanel, project: Pick<ComicProject, 'cast'>): string[] {
  return referencedCast(panel, project)
    .map(({ url }) => url)
    .slice(0, MAX_REFERENCE_PICTURES);
}

/** The LoRA of a character, through the Characters library it was saved to, when it is on. */
export function characterLora(character: Pick<ComicCharacter, 'libraryId'>): CharacterLora | null {
  const lora = character.libraryId ? useCharacters.getState().presets.find((p) => p.id === character.libraryId)?.data.lora : undefined;
  return lora?.enabled ? lora : null;
}

/**
 * The LoRA a panel is drawn with for its characters: the one of its only character that has one, when it is installed and
 * made for the main model's family. With two or more such characters none is used: a LoRA acts on the whole picture, so
 * their looks would mix; their reference pictures and words still apply.
 */
export function castLora(panel: Pick<ComicPanel, 'cast'>, project: Pick<ComicProject, 'cast'>): CharacterLora | null {
  const loras = project.cast.filter((c) => panel.cast.includes(c.id)).flatMap((c) => characterLora(c) ?? []);
  if (loras.length !== 1) return null;
  const lora = loras[0]!;
  const model = findModel(lora.key);
  const main = findModel(useParams.getState().modelKey);
  return model && (!main || model.base === main.base) ? lora : null;
}

/**
 * The reference images (IP-Adapter) of a panel's characters: each one's picture, so the face and the clothes carry over.
 * Only when the comic turns them on (castReference), lightly and over the first part of the steps, so the model draws the
 * rest in its own style. Without that, or without an installed IP-Adapter model, there are none (the panel is
 * drawn from the words alone).
 */
export function characterRefs(panel: ComicPanel, project: Pick<ComicProject, 'cast' | 'castReference'>, regions?: StoredRegion[]): RefImageInput[] {
  const strength = project.castReference;
  const modelKey = strength ? defaultRefModelKey(useParams.getState().modelKey) : null;
  if (!modelKey || !strength) return [];
  let used = referencedCast(panel, project);
  // Without regions a creature's picture spreads over the people beside it (a boy drawn as a black shadow), so it is left
  // out and the creature is said in words only.
  if (!regions?.length && used.some(({ character }) => !character.nonHuman)) used = used.filter(({ character }) => !character.nonHuman);
  used = used.slice(0, MAX_REFERENCE_IMAGES);
  const weight = referenceWeight(strength, used.length);
  return used.map(({ character, url }) => {
    const region = regions?.find((r) => r.character.id === character.id);
    return { imageUrl: url, modelKey, clipVisionModel: 'ViT-H', weight, beginEnd: [0, CAST_REFERENCE_END], method: 'full', ...(region ? { regionImageUrl: region.imageUrl } : {}) };
  });
}

/** The main model draws regions: the SD family only. */
function regionsSupported(): boolean {
  const base = findModel(useParams.getState().modelKey)?.base;
  return base === 'sd-1' || base === 'sd-2' || base === 'sdxl';
}

/**
 * The regions a panel with several characters is drawn in, stored as pictures at the panel's size; undefined when the panel
 * is drawn as a whole (see castRegions) or the main model takes no regions.
 */
export async function panelRegions(ref: PanelRef): Promise<StoredRegion[] | undefined> {
  const regions = castRegions(ref.project, ref.panel);
  // Whether the model takes regions is the model of the panel's own page, not of the page on screen.
  if (!regions || !withPageDraw(ref.project, ref.project.pages[ref.pageIndex], regionsSupported)) return undefined;
  const size = panelSize(ref);
  return storeCastRegions(regions, size.width, size.height);
}

/** What the person drawn as this character does, when the panel keeps it (a scene's words per person). */
export function personWords(panel: Pick<ComicPanel, 'poseCast' | 'poseWords'>, characterId: string): string {
  const at = panel.poseCast?.findIndex((id) => id === characterId) ?? -1;
  return at >= 0 ? (panel.poseWords?.[at] ?? '') : '';
}

/**
 * The regional layers of a panel drawn in regions: each character's words, and what that person does, inside its region,
 * kept out of the others.
 */
export function regionLayers(panel: ComicPanel, regions: StoredRegion[] | undefined): RegionalLayerInput[] {
  return (regions ?? []).flatMap(({ character, imageUrl }) => {
    const words = [characterWords(character, panel.prompt), personWords(panel, character.id)].filter(Boolean).join(', ');
    return words ? [{ imageUrl, positivePrompt: words, negativePrompt: character.negative?.trim() || null, autoNegative: true }] : [];
  });
}

/** Words that make the engine draw the character alone, centred and plain: a reference picture holds one look and nothing else. */
const PORTRAIT_WORDS = 'solo, cowboy shot, looking at viewer, standing, simple background, white background';
/** The same for a monster or an animal: nobody else, and its whole body in view. */
const CREATURE_PORTRAIT_WORDS = 'solo, no humans, full body, simple background, white background';
const PORTRAIT_NEGATIVE = 'multiple views, 2boys, 2girls, multiple dogs, extra characters, crowd, text, watermark';

/** What each view of a sheet asks for after the character's words: the angle and the framing, alone on a plain background. */
const VIEW_WORDS: Record<SheetView, string> = {
  threeQuarter: 'solo, standing, cowboy shot, three-quarter view, looking to the side, simple background, white background',
  side: 'solo, standing, full body, from side, profile, simple background, white background',
  back: 'solo, standing, full body, from behind, facing away, simple background, white background',
  face: 'solo, portrait, close-up, face focus, looking at viewer, simple background, white background',
};
/** The same for a monster or an animal. */
const CREATURE_VIEW_WORDS: Record<SheetView, string> = {
  threeQuarter: 'solo, no humans, full body, three-quarter view, simple background, white background',
  side: 'solo, no humans, full body, from side, simple background, white background',
  back: 'solo, no humans, full body, from behind, simple background, white background',
  face: 'solo, no humans, close-up, face focus, simple background, white background',
};
/** A view from behind shows no face, whichever way the front picture it is drawn from looks. */
const VIEW_NEGATIVE: Partial<Record<SheetView, string>> = { back: 'looking at viewer, face, eyes' };
/** The prompt a view's words are chosen for, so a view from behind or of the face names only the parts it shows. */
const VIEW_FRAMING: Record<SheetView, string> = { threeQuarter: '', side: '', back: 'from behind', face: 'close-up' };

/**
 * The queue request that draws one view of a character's sheet: the character's words for that view, with its front picture
 * as the reference (IP-Adapter) so the face and the clothes carry over while the words turn it. Every view is drawn from the
 * front, never from another view. Null when the front picture is not in the gallery or the character has no words.
 */
export function sheetRequest(character: ComicCharacter, view: SheetView): EnqueueRequest | null {
  const front = character.imageName ? findImage(character.imageName)?.url : undefined;
  const words = characterWords(character, VIEW_FRAMING[view]);
  if (!front || !words) return null;
  const p = useParams.getState();
  // A model that takes pictures in itself gets the front as one; the others through an IP-Adapter.
  const inItself = takesReferencePictures();
  const modelKey = inItself ? null : defaultRefModelKey(p.modelKey);
  const fromFront: RefImageInput[] = modelKey ? [{ imageUrl: front, modelKey, clipVisionModel: 'ViT-H', weight: CHARACTER_REF_WEIGHT, beginEnd: [0, 1], method: 'full' }] : [];
  const { params: generation, refImages } = txt2imgParts(fromFront);
  if (fromFront.length && generation.cfgScale > CHARACTER_MAX_CFG) generation.cfgScale = CHARACTER_CFG;
  const params: GenerationMetadata = {
    ...generation,
    positivePrompt: `${words}, ${(character.nonHuman ? CREATURE_VIEW_WORDS : VIEW_WORDS)[view]}`,
    negativePrompt: [PORTRAIT_NEGATIVE, VIEW_NEGATIVE[view]].filter(Boolean).join(', '),
    width: 1024,
    height: 1024,
  };
  return { origin: 'generate', destination: 'gallery', params, iterations: 1, randomizeSeed: p.shouldRandomizeSeed, prepend: false, boardId: autoAddBoardId(), ...(refImages.length ? { refImages } : {}), ...(inItself ? { referencePictures: [front] } : {}) };
}

/**
 * The queue request that draws a character's reference picture: its tags alone, on a plain background, with no pose and no
 * reference, so the face and the clothes are the only thing in the picture (a panel's picture holds a place, other people
 * and an animal too, and the reference would carry them all). Null when the character has no tags to draw from.
 */
export function portraitRequest(character: ComicCharacter): EnqueueRequest | null {
  const tags = allWords(character);
  if (!tags) return null;
  const p = useParams.getState();
  const { params: generation } = txt2imgParts([]);
  const params: GenerationMetadata = {
    ...generation,
    positivePrompt: `${tags}, ${character.nonHuman ? CREATURE_PORTRAIT_WORDS : PORTRAIT_WORDS}`,
    negativePrompt: PORTRAIT_NEGATIVE,
    width: 1024,
    height: 1024,
  };
  return { origin: 'generate', destination: 'gallery', params, iterations: 1, randomizeSeed: p.shouldRandomizeSeed, prepend: false, boardId: autoAddBoardId() };
}

/**
 * The queue request that draws the panel. One picture per panel: the count and the batch settings of Generate do not
 * apply, and the panel's size replaces the Generate size. Dynamic prompt syntax is expanded to the one prompt the panel
 * is drawn with (see panelPrompt).
 */
export function panelRequest(ref: PanelRef, prepend: boolean, regions?: StoredRegion[]): EnqueueRequest {
  // A panel is drawn with the settings of its own page, whichever page is on screen.
  return withPageDraw(ref.project, ref.project.pages[ref.pageIndex], () => panelRequestNow(ref, prepend, regions));
}

function panelRequestNow(ref: PanelRef, prepend: boolean, regions?: StoredRegion[]): EnqueueRequest {
  const page = ref.project.pages[ref.pageIndex];
  const size = panelSize(ref);
  const p = useParams.getState();
  const controlLayers = [...poseControl(ref.panel), ...depthControl(ref.panel, size)];
  // A model that takes pictures in itself (FLUX.2) gets the characters' pictures directly, the others through an IP-Adapter.
  const pictures = takesReferencePictures() ? castPictures(ref.panel, ref.project) : [];
  const fromCast = takesReferencePictures() ? [] : characterRefs(ref.panel, ref.project, regions);
  const regionalLayers = regionLayers(ref.panel, regions);
  // The character references are light and stop early, so the CFG scale stays as set: lowered for them, as
  // the Generate tab's characters do, the panels came out dull.
  const { params: generation, refImages } = txt2imgParts(fromCast);
  const style = styleOf(ref.project, page, findModel(p.modelKey)?.base ?? null);
  // A character's LoRA comes with its trigger word, which calls the character up.
  const lora = castLora(ref.panel, ref.project);
  const template = drawTemplate(ref, regions);
  // The random mode picks its prompt by the picture's seed, so the seed is settled here and sent with the request.
  const pickedByRandom = p.dynamicPromptMode === 'random' && hasDynamicSyntax(template);
  const seed = pickedByRandom && p.shouldRandomizeSeed ? randomSeed() : generation.seed;
  const params: GenerationMetadata = {
    ...generation,
    seed,
    positivePrompt: panelPrompt(template, seed, p.dynamicPromptMode),
    negativePrompt: [style.negative, panelNegative(ref.project, ref.panel, regions)].filter(Boolean).join(', '),
    width: size.width,
    height: size.height,
    ...(lora ? { loras: [...generation.loras.filter((l) => l.key !== lora.key), { key: lora.key, weight: lora.weight, isEnabled: true }] } : {}),
    ...(controlLayers.length ? { controlLayerCount: controlLayers.length } : {}),
    ...(regionalLayers.length ? { regionalGuidanceCount: regionalLayers.length } : {}),
  };
  return {
    origin: 'generate',
    destination: 'gallery',
    params,
    iterations: 1,
    randomizeSeed: p.shouldRandomizeSeed && !pickedByRandom,
    prepend,
    boardId: autoAddBoardId(),
    ...(refImages.length ? { refImages } : {}),
    ...(controlLayers.length ? { controlLayers } : {}),
    ...(regionalLayers.length ? { regionalLayers } : {}),
    ...(pictures.length ? { referencePictures: pictures } : {}),
  };
}

/**
 * The batches that draw a panel. The first draws the panel itself. In the combinations mode each further combination of
 * the prompt is a batch of its own, whose picture goes to the gallery only (the panel keeps the first picture).
 */
export function panelBatches(ref: PanelRef, prepend: boolean, regions?: StoredRegion[]): EnqueueRequest[] {
  const first = panelRequest(ref, prepend, regions);
  const template = withPageDraw(ref.project, ref.project.pages[ref.pageIndex], () => drawTemplate(ref, regions));
  if (useParams.getState().dynamicPromptMode !== 'combinatorial' || !hasDynamicSyntax(template)) return [first];
  const prompts = expandPrompt(template, undefined, wildcardMap(useWildcards.getState().lists));
  return [first, ...prompts.slice(1).map((positivePrompt) => ({ ...first, params: { ...first.params, positivePrompt } }))];
}

/** The longest side a part is redrawn at: a larger picture (one put in from a file) is redrawn smaller and enlarged back. */
const FIX_MAX_SIDE = 2048;

/**
 * The size a picture of `width` × `height` is redrawn at: its own, held to FIX_MAX_SIDE and to whole multiples of 8 (the
 * engine scales the picture and the mask to it, and pastes the result back over the picture).
 */
export function fixSize(width: number, height: number): { width: number; height: number } {
  const shrink = Math.min(1, FIX_MAX_SIDE / Math.max(width, height, 1));
  const side = (v: number) => Math.max(64, Math.floor((v * shrink) / 8) * 8);
  return { width: side(width), height: side(height) };
}

/**
 * The queue request that redraws a part of a panel's picture (inpaint): the panel's prompt and its characters' words and
 * reference pictures, the picture as the source and the mask of the part. `words` replaces the panel's own prompt when given
 * (what to draw there); the pose is left out, as the rest of the picture already holds the people.
 */
export function fixRequest(ref: PanelRef, source: { url: string; width: number; height: number }, maskUrl: string, options: { words?: string; strength: number }): EnqueueRequest {
  return withPageDraw(ref.project, ref.project.pages[ref.pageIndex], () => {
    const p = useParams.getState();
    const fromCast = characterRefs(ref.panel, ref.project);
    const { params: generation, refImages } = txt2imgParts(fromCast);
    // The high-resolution fix is a pass of text or image to image, not of inpainting.
    delete generation.hiresFix;
    const words = options.words?.trim();
    const panel = words ? { ...ref.panel, prompt: words } : ref.panel;
    const style = styleOf(ref.project, ref.project.pages[ref.pageIndex], findModel(p.modelKey)?.base ?? null);
    const prompt = [style.positive, panelTemplate(panel, ref.project)].filter(Boolean).join(', ');
    const size = fixSize(source.width, source.height);
    const params: GenerationMetadata = {
      ...generation,
      generationMode: 'inpaint',
      positivePrompt: panelPrompt(prompt, generation.seed, p.dynamicPromptMode),
      negativePrompt: [style.negative, panelNegative(ref.project, ref.panel)].filter(Boolean).join(', '),
      width: size.width,
      height: size.height,
      strength: options.strength,
      maskBlur: p.maskBlur,
    };
    return {
      origin: 'generate',
      destination: 'gallery',
      params,
      iterations: 1,
      randomizeSeed: p.shouldRandomizeSeed,
      prepend: false,
      boardId: autoAddBoardId(),
      initImageUrl: source.url,
      maskImageUrl: maskUrl,
      ...(refImages.length ? { refImages } : {}),
    };
  });
}

/** The panels of the page on screen that can be drawn (they have a prompt), in reading order. */
export function pagePanelIds(): string[] {
  const page = activePage(useComic.getState());
  return (page?.panels ?? []).filter((p) => p.prompt.trim()).map((p) => p.id);
}

/** The panels of every page of the open comic that can be drawn (they have a prompt), in reading order. */
export function comicPanelIds(): string[] {
  const project = activeProject(useComic.getState());
  return (project?.pages ?? []).flatMap((pg) => pg.panels.filter((p) => p.prompt.trim()).map((p) => p.id));
}

/** Why nothing can be drawn for want of a prompt, for the draw scope now; null when there is a prompt to draw from. */
export function promptReason(): string | null {
  const state = useComic.getState();
  if (state.drawScope === 'comic') return comicPanelIds().length ? null : t('comic.readiness.noPromptsComic');
  if (state.drawScope === 'page') return pagePanelIds().length ? null : t('comic.readiness.noPrompts');
  const ref = workPanel(state);
  return ref && !ref.panel.prompt.trim() ? t('comic.readiness.noPrompt', { number: ref.panelIndex + 1 }) : null;
}

/** Why the draw button cannot draw right now (empty = ready): for the selected panel, or for the page. */
export function comicReadiness(): string[] {
  const reasons: string[] = [];
  const p = useParams.getState();
  if (!p.modelKey || !findModel(p.modelKey)) reasons.push(t('comic.readiness.noModel'));
  else {
    const partsReason = modelPartsReason(p.modelKey);
    if (partsReason) reasons.push(partsReason);
  }
  const state = useComic.getState();
  if (state.drawScope === 'panel' && !workPanel(state)) reasons.push(t('comic.readiness.noPanel'));
  else {
    const noPrompt = promptReason();
    if (noPrompt) reasons.push(noPrompt);
  }
  // The Generate tab's reference images run on the IP-Adapter pack, so a missing pack stops the picture.
  const packReason = refImagesPackReason(p.refImages);
  if (packReason) reasons.push(packReason);
  const encoderReason = refImagesEncoderReason(p.refImages, useModels.getState().models);
  if (encoderReason) reasons.push(encoderReason);
  return reasons;
}

/**
 * Hints that do not block drawing: a pose or a 3D rough's depth map that will not reach the picture (its model is missing),
 * and a prompt with several combinations in the combinations mode, of which the panel draws only the first.
 */
export function comicWarnings(): string[] {
  const warnings: string[] = [];
  const ref = workPanel(useComic.getState());
  if (!ref) return warnings;
  if (ref.panel.poseImageName && !poseModelKey()) warnings.push(t('comic.warning.noPoseModel'));
  if (ref.panel.depthImageName && !depthModelKey()) warnings.push(t('comic.warning.noDepthModel'));
  if (roughOutOfShape(ref.panel, panelSize(ref))) warnings.push(t('comic.warning.roughOutOfShape'));
  const template = withPageDraw(ref.project, ref.project.pages[ref.pageIndex], () => drawTemplate(ref));
  if (useParams.getState().dynamicPromptMode === 'combinatorial' && hasDynamicSyntax(template)) {
    const count = expandPrompt(template, undefined, wildcardMap(useWildcards.getState().lists)).length;
    if (count > 1) warnings.push(t('comic.warning.combinations', { count }));
  }
  return warnings;
}

/** The panel for an id, if it still exists and has a prompt to draw from. */
export function drawablePanel(panelId: string): PanelRef | null {
  const ref = findPanel(useComic.getState().projects, panelId);
  return ref && ref.panel.prompt.trim() ? ref : null;
}
