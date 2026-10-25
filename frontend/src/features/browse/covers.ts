// Cover pictures of the browsed models: a real model carries its own URLs; the browser mock stands a picture in for each.
import { type CivitaiModel, standInCover } from '@/backend';

type CoverModel = Pick<CivitaiModel, 'id' | 'imageUrls'>;

/** The index-th cover of a model, or an empty URL past the last real one (and for a model without URLs outside the mock). */
export function coverUrl(model: CoverModel, index: number): string {
  if (model.imageUrls) return model.imageUrls[index] ?? '';
  return standInCover(`${model.id}:${index}`) ?? '';
}

/**
 * The video behind a still cover, or null for a picture. The backend (`still_url` in `models/civitai.rs`) shows a Civitai video
 * by its first frame, `.../anim=false,width=512/<name>.mp4`; the same path without `anim=false` is the video itself.
 */
export function coverVideoUrl(url: string): string | null {
  return /\/anim=false,width=512\/[^/]+\.(mp4|webm)$/i.test(url) ? url.replace('/anim=false,width=512/', '/width=512/') : null;
}
