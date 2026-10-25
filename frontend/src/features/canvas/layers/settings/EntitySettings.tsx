// Settings shown under the selected entity row, by entity type.
import type { CanvasEntity } from '@/state/canvas';
import { BlendField } from './BlendField';
import { ControlSettings } from './ControlSettings';
import { InpaintSettings } from './InpaintSettings';
import { OpacityField } from './OpacityField';
import { RegionalSettings } from './RegionalSettings';

export function EntitySettings({ entity }: { entity: CanvasEntity }) {
  switch (entity.type) {
    case 'control':
      return <ControlSettings entity={entity} />;
    case 'inpaint':
      return <InpaintSettings entity={entity} />;
    case 'regional':
      return <RegionalSettings entity={entity} />;
    case 'raster':
      return (
        <div className="canvas-settings">
          <OpacityField entity={entity} />
          <BlendField entity={entity} />
        </div>
      );
  }
}
