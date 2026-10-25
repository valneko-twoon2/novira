// The selected panel's tools in the page's toolbar, each opening a popover: balloons and captions (each kind drawn as it
// looks, which adds one; and the panel's balloons, to pick one; the editor of a balloon opens beside the page, see
// BubbleEditor), the
// pose (from the pose editor, a ready-made one from the canvas's list, or the panel's 3D rough), the characters and the
// place of the panel, the stage direction, and the panel templates saved in the project.
import { useState, type ReactElement } from 'react';
import { BookmarkSimple, ChatCircleText, CubeFocus, MapPin, Notepad, PencilSimple, PersonSimple, Trash, UsersThree } from '@phosphor-icons/react';
import { backend } from '@/backend';
import { t, tCount } from '@/i18n';
import { PANEL_NOTE_MAX, type ComicBubble, type ComicCharacter, type ComicPage, type ComicPanel, type ComicPanelTemplate, type ComicPlace } from '@/state/comic/document';
import { pageAspect, panelGeometry, panelPixels } from '@/state/comic/layout';
import { putPosePreset } from '@/state/comic/posePreset';
import { useComic } from '@/state/comic/store';
import { usePoseDialog } from '@/state/dialogs/pose';
import { useGallery } from '@/state/gallery';
import { autoAddBoardId } from '@/state/invoke';
import { POSE_CATEGORIES } from '@/state/pose/posePresets';
import { toast } from '@/state/toasts';
import { Button, IconButton, Popover, PopoverContent, PopoverTrigger, Select, Textarea, TextInput, TOOLBAR_BUTTON_SIZE } from '@/ui';
import { BALLOON_PRESETS, BalloonPreview, presetLabel } from './BalloonPreview';
import { CastSection } from './CastSection';
import { PanelPlace } from './PanelPlace';
import { RoughDialog } from './rough/RoughDialog';

/** A toolbar button that opens a popover under it. */
function ToolPopover({ label, icon, testId, wide, children }: { label: string; icon: ReactElement; testId: string; wide?: boolean; children: ReactElement }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <IconButton size={TOOLBAR_BUTTON_SIZE} label={label} icon={icon} tooltip={false} title={label} data-testid={testId} />
      </PopoverTrigger>
      {/* Escape closes the popover only: the page's Escape key (which lets go of the balloon) does not see it. */}
      <PopoverContent side="bottom" align="start" className={wide ? 'comic-tool-pop is-wide' : 'comic-tool-pop'} onEscapeKeyDown={(e) => e.stopPropagation()}>
        <div className="comic-settings__body">
          <h3 className="comic-settings__title">{label}</h3>
          {children}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function PanelTools({
  page,
  panel,
  panelIndex,
  templates,
  cast,
  places,
}: {
  page: ComicPage;
  panel: ComicPanel;
  panelIndex: number;
  templates: ComicPanelTemplate[];
  cast: ComicCharacter[];
  places: ComicPlace[];
}) {
  const selectedBubbleId = useComic((s) => s.selectedBubbleId);
  const box = panelGeometry(page)[panelIndex]?.box;
  const size = box ? panelPixels(box, pageAspect(page.size)) : { width: 1024, height: 1024 };
  const store = useComic.getState;
  const [roughOpen, setRoughOpen] = useState(false);

  // Opens the pose editor at the panel's shape. Its picture replaces the panel's poses (the editor shows one person).
  const editPose = () => {
    usePoseDialog.getState().open({
      width: size.width,
      height: size.height,
      initial: panel.poses[0] ?? null,
      onUse: async (pose, picture) => {
        const image = await backend.uploadImage(picture, { boardId: autoAddBoardId(), category: 'control' });
        useGallery.getState().addImage(image);
        useComic.getState().setPanelPose(panel.id, [pose], image.name);
      },
    });
  };

  return (
    <div className="comic-view__group" role="group" aria-label={t('comic.panel.tools')} data-testid="comic-panel-tools">
      <ToolPopover label={t('comic.panel.bubbles')} icon={<ChatCircleText />} testId="comic-bubbles" wide>
        <>
          <div className="comic-balloon-grid" role="group" aria-label={t('comic.bubble.add')}>
            {BALLOON_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                className="comic-balloon-tile"
                onClick={() => {
                  // A new balloon opens its editor beside the page, ready for its words.
                  const id = store().addBubble(panel.id, preset.kind, preset.look);
                  if (id) store().openBubbleEditor(panel.id, id);
                }}
                data-testid={`comic-add-${preset.id}`}
              >
                <BalloonPreview kind={preset.kind} look={preset.look} />
                <span className="comic-balloon-tile__name">{presetLabel(preset)}</span>
              </button>
            ))}
          </div>
          {panel.bubbles.map((bubble) => (
            <BubbleRow key={bubble.id} bubble={bubble} panelId={panel.id} selected={bubble.id === selectedBubbleId} />
          ))}
          {panel.bubbles.length > 0 && <p className="comic-hint">{t('comic.bubble.editHint')}</p>}
        </>
      </ToolPopover>
      <ToolPopover label={t('comic.panel.pose')} icon={<PersonSimple />} testId="comic-pose-tools">
        <>
          <div className="comic-detail__row">
            <Button variant="outline" size="sm" onClick={editPose} data-testid="comic-pose">
              {panel.poses.length ? t('comic.panel.poseEdit') : t('comic.panel.pose')}
            </Button>
            {panel.poses.length > 0 && (
              <Button variant="outline" size="sm" onClick={() => store().setPanelPose(panel.id, [], null)} data-testid="comic-pose-remove">
                {t('comic.panel.poseRemove')}
              </Button>
            )}
          </div>
          <PosePresets panelId={panel.id} width={size.width} height={size.height} />
          {panel.poses.length > 0 && <p className="comic-hint">{tCount('comic.panel.poseCount', panel.poses.length)}</p>}
          <div className="comic-detail__row">
            <Button variant="outline" size="sm" leftIcon={<CubeFocus />} onClick={() => setRoughOpen(true)} data-testid="comic-rough-open">
              {t('comic.rough.open')}
            </Button>
          </div>
          <p className="comic-hint" data-testid="comic-rough-state">
            {panel.rough ? t(panel.depthImageName ? 'comic.rough.inUse' : 'comic.rough.dropped') : t('comic.rough.help')}
          </p>
        </>
      </ToolPopover>
      <ToolPopover label={t('comic.cast.title')} icon={<UsersThree />} testId="comic-cast-tools" wide>
        <CastSection panelId={panel.id} panelCast={panel.cast} panelImage={panel.imageName} cast={cast} posePeople={panel.poses.length} poseCast={panel.poseCast} />
      </ToolPopover>
      <ToolPopover label={t('comic.place.title')} icon={<MapPin />} testId="comic-place-tools" wide>
        <PanelPlace panelId={panel.id} placeId={panel.place ?? null} places={places} />
      </ToolPopover>
      <ToolPopover label={t('comic.panel.note')} icon={<Notepad />} testId="comic-note-tools">
        <>
          <Textarea
            className="comic-note"
            value={panel.note}
            maxLength={PANEL_NOTE_MAX}
            onChange={(e) => store().setPanelNote(panel.id, e.target.value)}
            placeholder={t('comic.panel.notePlaceholder')}
            aria-label={t('comic.panel.note')}
            data-testid="comic-note"
          />
          <p className="comic-hint">{t('comic.panel.noteHelp')}</p>
        </>
      </ToolPopover>
      <ToolPopover label={t('comic.template.panelTitle')} icon={<BookmarkSimple />} testId="comic-panel-templates">
        <PanelTemplates panelId={panel.id} templates={templates} />
      </ToolPopover>
      {/* Outside the pose popover, which closes when the editor takes the focus. */}
      {roughOpen && <RoughDialog open panel={panel} width={size.width} height={size.height} onClose={() => setRoughOpen(false)} />}
    </div>
  );
}

/** A ready-made pose from the canvas's list, put into the panel: the category, then the pose. */
function PosePresets({ panelId, width, height }: { panelId: string; width: number; height: number }) {
  const [categoryId, setCategoryId] = useState(POSE_CATEGORIES[0]?.id ?? '');
  const category = POSE_CATEGORIES.find((c) => c.id === categoryId) ?? POSE_CATEGORIES[0];
  const [presetId, setPresetId] = useState(category?.presets[0]?.id ?? '');
  const preset = category?.presets.find((p) => p.id === presetId) ?? category?.presets[0];
  return (
    <div className="comic-presets" data-testid="comic-pose-presets">
      <Select<string>
        value={category?.id ?? null}
        onChange={(id) => {
          setCategoryId(id);
          setPresetId(POSE_CATEGORIES.find((c) => c.id === id)?.presets[0]?.id ?? '');
        }}
        options={POSE_CATEGORIES.map((c) => ({ value: c.id, label: t(c.label) }))}
        aria-label={t('comic.panel.poseCategory')}
      />
      <Select<string>
        value={preset?.id ?? null}
        onChange={setPresetId}
        options={(category?.presets ?? []).map((p) => ({ value: p.id, label: t(p.label) }))}
        aria-label={t('comic.panel.posePreset')}
      />
      <Button
        variant="outline"
        size="sm"
        disabled={!preset}
        onClick={() => {
          if (!preset) return;
          putPosePreset(panelId, preset.id, width, height).catch((err: unknown) =>
            toast({ status: 'error', title: t('comic.panel.poseFailed'), description: err instanceof Error ? err.message : String(err) }),
          );
        }}
        data-testid="comic-pose-preset-apply"
      >
        {t('comic.panel.poseApply')}
      </Button>
    </div>
  );
}

/** The panel's settings saved as templates of the project, and the saved ones put into this panel. The panel's picture is not part of them. */
function PanelTemplates({ panelId, templates }: { panelId: string; templates: ComicPanelTemplate[] }) {
  const [name, setName] = useState('');
  return (
    <>
      <div className="comic-detail__row">
        <TextInput value={name} placeholder={t('comic.template.namePlaceholder')} aria-label={t('comic.template.name')} onChange={(e) => setName(e.target.value)} />
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            useComic.getState().savePanelTemplate(panelId, name.trim() || t('comic.template.defaultName', { number: templates.length + 1 }));
            setName('');
          }}
          data-testid="comic-panel-template-save"
        >
          {t('comic.template.save')}
        </Button>
      </div>
      {templates.length === 0 && <p className="comic-hint">{t('comic.template.empty')}</p>}
      {templates.map((template) => (
        <div key={template.id} className="comic-detail__row comic-template" data-testid="comic-panel-template">
          <span className="comic-template__name">{template.name}</span>
          <Button variant="outline" size="sm" onClick={() => useComic.getState().applyPanelTemplate(panelId, template.id)} data-testid="comic-panel-template-apply">
            {t('comic.template.apply')}
          </Button>
          <IconButton label={t('comic.template.delete')} icon={<Trash />} size="xs" onClick={() => useComic.getState().deletePanelTemplate(template.id)} />
        </div>
      ))}
    </>
  );
}

/** A balloon of the panel in the list: its kind and words, which select it; the pencil opens its editor beside the page. */
function BubbleRow({ bubble, panelId, selected }: { bubble: ComicBubble; panelId: string; selected: boolean }) {
  const words = bubble.text.trim();
  return (
    <div className={`comic-bubble-row${selected ? ' is-selected' : ''}`} data-testid="comic-bubble-row">
      <button
        type="button"
        className="comic-bubble-row__pick"
        aria-pressed={selected}
        onClick={() => {
          useComic.getState().selectPanel(panelId);
          useComic.getState().selectBubble(bubble.id);
        }}
        onDoubleClick={() => useComic.getState().openBubbleEditor(panelId, bubble.id)}
      >
        <span className="comic-bubble-row__kind">{t(`comic.bubble.kind.${bubble.kind}`)}</span>
        <span className={`comic-bubble-row__text${words ? '' : ' is-empty'}`}>{words || t('comic.bubble.noText')}</span>
      </button>
      <IconButton
        label={t('comic.bubble.edit')}
        icon={<PencilSimple />}
        size="xs"
        onClick={() => useComic.getState().openBubbleEditor(panelId, bubble.id)}
        data-testid="comic-bubble-edit"
      />
      <IconButton label={t('comic.bubble.remove')} icon={<Trash />} size="xs" onClick={() => useComic.getState().removeBubble(panelId, bubble.id)} />
    </div>
  );
}
