// The Generate tab of the phone layout: the desktop's left panel itself (presets, the seed and Generate row, the model card,
// the prompts, reference images and the parameter sections), so a phone has the same controls in the same order and a
// picture started here is the one the PC would have drawn. phone.css only lays it out for a finger.
import { ParametersPanel } from '@/features/params/ParametersPanel';

export function PhoneGenerate() {
  return (
    <div className="phone-gen" data-testid="phone-generate">
      <ParametersPanel tab="generate" />
    </div>
  );
}
