// Plugs every feature into the registries of state/ (Invoke builders, assistant editors, drag sources) at start-up.
// `registerFeatures.test.ts` checks that every screen ends up with what it needs, so a new screen cannot be forgotten here.
import { registerCanvasFeature } from '@/features/canvas/register';
import { registerComicFeature } from '@/features/comic';
import { registerLogoFeature } from '@/features/logo/register';
import { registerMusicFeature } from '@/features/music/register';
import { registerParamsFeature } from '@/features/params/register';
import { registerTextFeature } from '@/features/text/register';
import { registerVideoFeature } from '@/features/video/register';
import { registerVoiceFeature } from '@/features/voice/register';
import { registerWorkflowsFeature } from '@/features/workflows/register';

export function registerFeatures() {
  registerParamsFeature();
  registerCanvasFeature();
  registerComicFeature();
  registerWorkflowsFeature();
  registerVideoFeature();
  registerMusicFeature();
  registerVoiceFeature();
  registerLogoFeature();
  registerTextFeature();
}
