// "Register as a character": a name, the pictures of the character (any number), the words that describe the character
// and how strongly to follow the pictures. With the background-removal pack installed each new picture is first put on
// a plain white background, so its background colour does not leak into the pictures generated from it.
import { WarningCircle, X } from '@phosphor-icons/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { t, tCount } from '@/i18n';
import { DEFAULT_CHARACTER_WEIGHT, DEFAULT_LORA_WEIGHT, MAX_REFERENCE_IMAGES, useCharacters, type CharacterLora } from '@/state/characters';
import { useComfyNodes } from '@/state/comfy/comfyNodes';
import { CUTOUT_NODE, buildCutoutGraph, cutoutModels } from '@/state/comfy/cutout';
import { graphRequest } from '@/state/comfy/graphJob';
import { runJob } from '@/state/comfy/runGraph';
import { useCharacterDialog } from '@/state/dialogs/character';
import { useModels } from '@/state/models';
import { findImage, useGallery } from '@/state/gallery';
import { toast } from '@/state/toasts';
import { Button, IconButton, Modal, Select, SliderNumber, Switch, TextInput, Textarea } from '@/ui';
import './characters.css';

/** The select's value for no LoRA. */
const NO_LORA = '__no_lora__';

export function CharacterDialog() {
  const target = useCharacterDialog((s) => s.target);
  const close = useCharacterDialog((s) => s.close);
  const defs = useComfyNodes((s) => s.defs);
  const cutoutModel = useMemo(() => cutoutModels(defs)[0], [defs]);
  const canWhiten = !!defs?.[CUTOUT_NODE] && !!cutoutModel;

  const [name, setName] = useState('');
  const [tags, setTags] = useState('');
  const [weight, setWeight] = useState(DEFAULT_CHARACTER_WEIGHT);
  const [whiten, setWhiten] = useState(true);
  /** The character's LoRA as edited here (on / off, weight); kept when the character is saved. */
  const [lora, setLora] = useState<CharacterLora | undefined>(undefined);
  /** The pictures in order, and which of them were added in this dialog (only those are put on white). */
  const [names, setNames] = useState<string[]>([]);
  const [fresh, setFresh] = useState<string[]>([]);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);

  // A fresh start each time it opens; an edit starts from what the character holds.
  useEffect(() => {
    abort.current?.abort();
    setError(null);
    if (!target) return;
    const saved = target.editId ? useCharacters.getState().presets.find((p) => p.id === target.editId) : undefined;
    setName(target.name ?? '');
    setTags(saved?.data.tags ?? '');
    setWeight(saved?.data.weight ?? DEFAULT_CHARACTER_WEIGHT);
    setLora(saved?.data.lora);
    setWhiten(true);
    setNames(target.imageNames);
    setFresh(target.editId ? [] : target.imageNames);
    void useComfyNodes.getState().load();
  }, [target]);

  /** The pictures selected in the gallery that the character does not hold yet. */
  const images = useGallery((s) => s.images);
  const selection = useGallery((s) => s.selection);
  const addable = useMemo(() => images.filter((i) => selection.includes(i.name) && (i.mediaType ?? 'image') === 'image' && !names.includes(i.name)), [images, selection, names]);

  const addSelected = () => {
    if (!addable.length) {
      toast({ status: 'info', title: t('character.addNone') });
      return;
    }
    const added = addable.map((i) => i.name);
    setNames((n) => [...n, ...added]);
    setFresh((f) => [...f, ...added]);
  };

  const remove = (picture: string) => {
    setNames((n) => n.filter((x) => x !== picture));
    setFresh((f) => f.filter((x) => x !== picture));
  };

  const save = async () => {
    if (!target || !names.length || !name.trim()) return;
    const controller = new AbortController();
    abort.current = controller;
    setRunning(true);
    setProgress(0);
    setError(null);
    try {
      const saved: string[] = [];
      for (const picture of names) {
        const source = findImage(picture);
        if (whiten && canWhiten && cutoutModel && fresh.includes(picture) && source) {
          const graph = buildCutoutGraph(source.name, { model: cutoutModel, sensitivity: 1, edge: 0, background: 'white' });
          const result = await runJob(graphRequest(graph, 'gallery', source.boardId, { width: source.width, height: source.height }), controller.signal);
          saved.push(result.name);
        } else saved.push(picture);
        setProgress((p) => p + 1);
      }
      const data = { imageNames: saved, weight, tags: tags.trim(), ...(lora ? { lora } : {}) };
      const store = useCharacters.getState();
      if (target.editId) {
        store.overwrite(target.editId, data);
        store.rename(target.editId, name.trim());
      } else store.add(name.trim(), data);
      toast({ status: 'success', title: t('character.saved', { name: name.trim() }) });
      close();
    } catch (e) {
      if (!controller.signal.aborted) setError(e instanceof Error ? e.message : String(e));
    } finally {
      abort.current = null;
      setRunning(false);
    }
  };

  const hasFresh = fresh.some((f) => names.includes(f));
  const loraModel = useModels((s) => (lora ? s.models.find((m) => m.key === lora.key) : undefined));
  const models = useModels((s) => s.models);
  const loraOptions = useMemo(
    () => [
      { value: NO_LORA, label: t('lora.noneOption') },
      ...models.filter((m) => m.type === 'lora').map((m) => ({ value: m.key, label: m.name })),
      ...(lora && !models.some((m) => m.key === lora.key) ? [{ value: lora.key, label: t('lora.gone') }] : []),
    ],
    [models, lora],
  );
  /** Chooses the LoRA to use with the character (its first trigger phrase becomes the trigger word), or none. */
  const pickLora = (key: string) => {
    if (key === NO_LORA) return setLora(undefined);
    if (lora?.key === key) return;
    const model = models.find((m) => m.key === key);
    setLora({ key, weight: DEFAULT_LORA_WEIGHT, trigger: model?.triggerPhrases?.[0] ?? '', enabled: true });
  };
  return (
    <Modal open={!!target} onOpenChange={(o) => !o && !running && close()} size="md" closeLabel={t('common.close')} title={target?.editId ? t('character.editTitle') : t('character.title')}>
      {!target ? null : (
        <div className="chdlg" data-testid="character-dialog">
          <div className="chdlg__field">
            <span>{t('character.pictures')}</span>
            {names.length ? (
              <ul className="chdlg__pics" data-testid="character-pictures">
                {names.map((picture) => {
                  const image = findImage(picture);
                  return (
                    <li key={picture} className="chdlg__pic" data-testid="character-picture">
                      {image ? <img src={image.thumbnailUrl} alt="" draggable={false} /> : <span className="chdlg__gone">?</span>}
                      <IconButton size="xs" label={t('character.removePicture')} icon={<X weight="bold" />} tooltip={false} disabled={running} onClick={() => remove(picture)} data-testid="character-picture-remove" />
                    </li>
                  );
                })}
              </ul>
            ) : (
              <span className="chdlg__hint">{t('character.noPicture')}</span>
            )}
            <div className="chdlg__row">
              <Button size="xs" variant="outline" disabled={running} onClick={addSelected} data-testid="character-add-selected">
                {t('character.addSelected')}
              </Button>
              <span className="chdlg__hint">{tCount('character.row.count', names.length)}</span>
            </div>
            <span className="chdlg__hint">{t('character.picturesHint', { max: MAX_REFERENCE_IMAGES })}</span>
          </div>
          <label className="chdlg__field">
            <span>{t('character.name')}</span>
            <TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder={t('character.namePlaceholder')} disabled={running} data-testid="character-name" />
          </label>
          <label className="chdlg__field">
            <span>{t('character.tags')}</span>
            <Textarea value={tags} onChange={(e) => setTags(e.target.value)} placeholder={t('character.tagsPlaceholder')} rows={2} disabled={running} data-testid="character-tags" />
            <span className="chdlg__hint">{t('character.tagsHint')}</span>
          </label>
          <label className="chdlg__field">
            <span>{t('character.weight')}</span>
            <SliderNumber value={weight} onChange={setWeight} min={0.2} max={1} step={0.05} precision={2} disabled={running} aria-label={t('character.weight')} />
            <span className="chdlg__hint">{t('character.weightHint')}</span>
            {names.length > 1 && <span className="chdlg__hint">{t('character.weightMany')}</span>}
          </label>
          {hasFresh && (
            <div className="chdlg__field">
              <label className="chdlg__switch">
                <Switch checked={whiten && canWhiten} onChange={setWhiten} disabled={running || !canWhiten} aria-label={t('character.whiteBg')} />
                <span>{t('character.whiteBg')}</span>
              </label>
              <span className="chdlg__hint">{canWhiten ? t('character.whiteBgHint') : t('character.whiteBgNeedsPack')}</span>
            </div>
          )}
          {target.editId && (
            <div className="chdlg__field" data-testid="character-lora">
              <span>{t('lora.section')}</span>
              <Select value={lora?.key ?? NO_LORA} onChange={pickLora} options={loraOptions} disabled={running} aria-label={t('lora.section')} data-testid="character-lora-select" />
              {lora && (
                <div className="chdlg__lora">
                  <label className="chdlg__switch">
                    <Switch checked={lora.enabled} onChange={(enabled) => setLora({ ...lora, enabled })} disabled={running} aria-label={t('lora.use')} />
                    <span>{t('lora.use')}</span>
                    <span className="chdlg__hint">{loraModel ? loraModel.name : t('lora.gone')}</span>
                  </label>
                  <SliderNumber value={lora.weight} onChange={(w) => setLora({ ...lora, weight: w })} min={0.1} max={1.5} step={0.05} precision={2} disabled={running || !lora.enabled} aria-label={t('lora.weight')} />
                  {lora.trigger && <span className="chdlg__hint">{t('lora.useHint', { trigger: lora.trigger })}</span>}
                </div>
              )}
            </div>
          )}
          {error && (
            <p className="chdlg__error" role="alert">
              <WarningCircle size={14} /> {t('character.failed')}: {error}
            </p>
          )}
          <div className="chdlg__actions">
            {running && (
              <Button variant="outline" onClick={() => abort.current?.abort()} data-testid="character-cancel">
                {t('common.cancel')}
              </Button>
            )}
            <Button variant="solid" scheme="invoke" disabled={!name.trim() || !names.length || running} isLoading={running} onClick={() => void save()} data-testid="character-save">
              {running ? t('character.saving', { done: progress, total: names.length }) : t('character.save')}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
