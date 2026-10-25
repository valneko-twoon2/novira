// "Extensions" tab of the Workflows left panel. It starts from what the user wants to do: big goal tiles, each opening
// the packs that do it (install, remove), plus a button that asks the AI assistant. Installing any GitHub pack by
// address and the ComfyUI restart that loads packs are below. Pack nodes appear under Extensions in Add Node.
import {
  ArrowClockwise,
  ArrowsOut,
  CaretLeft,
  Check,
  DownloadSimple,
  Feather,
  FilmStrip,
  PaintBrush,
  Palette,
  PersonSimpleWalk,
  Scissors,
  SlidersHorizontal,
  Smiley,
  Sparkle,
  TextAa,
  Toolbox,
  Trash,
  Warning,
} from '@phosphor-icons/react';
import { useEffect, useState, type ReactNode } from 'react';
import type { InstalledNodePack, PackStatus } from '@/backend';
import { t } from '@/i18n';
import { useAgent } from '@/state/agent';
import { packKey, useNodePacks } from '@/state/comfy/nodePacks';
import { PACK_CATALOG, PACK_GOALS, caveatKey, goalDescKey, goalTitleKey, packDescKey, packFolder, packsForGoal, type CatalogPack, type PackGoalId } from '@/state/comfy/packCatalog';
import { Badge, Button, ProgressBar, TextInput, cx } from '@/ui';

const GOAL_ICONS: Record<PackGoalId, ReactNode> = {
  face: <Smiley size={22} />,
  background: <Scissors size={22} />,
  partial: <PaintBrush size={22} />,
  upscale: <ArrowsOut size={22} />,
  pose: <PersonSimpleWalk size={22} />,
  style: <Palette size={22} />,
  video: <FilmStrip size={22} />,
  color: <SlidersHorizontal size={22} />,
  caption: <TextAa size={22} />,
  light: <Feather size={22} />,
  handy: <Toolbox size={22} />,
};

export function JobLine({ status }: { status: PackStatus }) {
  if (status.state === 'downloading')
    return <ProgressBar value={status.totalBytes ? status.bytes / status.totalBytes : 0} indeterminate={!status.totalBytes} className="wf-packs__progress" />;
  if (status.state === 'installing')
    return (
      <>
        <span className="wf-packs__step">{t('workflows.packs.installing')}</span>
        <ProgressBar value={0} indeterminate className="wf-packs__progress" />
      </>
    );
  if (status.state === 'error') return <p className="wf-packs__error">{status.message}</p>;
  return null;
}

export function RemoveButton({ folder }: { folder: string }) {
  const remove = useNodePacks((s) => s.remove);
  const [armed, setArmed] = useState(false);
  return (
    <Button
      size="xs"
      variant={armed ? 'solid' : 'ghost'}
      scheme={armed ? 'danger' : 'base'}
      leftIcon={<Trash size={12} />}
      onClick={() => (armed ? void remove(folder) : setArmed(true))}
      onBlur={() => setArmed(false)}
      data-testid="wf-pack-remove"
    >
      {armed ? t('workflows.packs.removeConfirm') : t('workflows.packs.remove')}
    </Button>
  );
}

export function useInstalledPack(pack: CatalogPack): InstalledNodePack | undefined {
  const installed = useNodePacks((s) => s.packs?.installed);
  return installed?.find((i) => i.url === packKey(pack.url) || i.folder === packFolder(pack.url));
}

/** One pack: what it does, a warning when there is one, and install / remove with its progress. */
export function PackCard({ pack }: { pack: CatalogPack }) {
  const installed = useInstalledPack(pack);
  const job = useNodePacks((s) => s.jobs[packKey(pack.url)]);
  const install = useNodePacks((s) => s.install);
  const cancel = useNodePacks((s) => s.cancel);
  const busy = job?.state === 'downloading' || job?.state === 'installing';
  return (
    <article className="wf-pack" data-testid="wf-pack" data-pack={pack.id}>
      <div className="wf-pack__head">
        <strong>{packFolder(pack.url)}</strong>
        <Badge>{pack.license}</Badge>
        {installed && (
          <Badge scheme="success">
            <Check size={10} weight="bold" /> {t('workflows.packs.installed')}
          </Badge>
        )}
      </div>
      <p className="wf-pack__desc">{t(packDescKey(pack.id))}</p>
      {pack.caveat && (
        <p className="wf-pack__caveat">
          <Warning size={12} /> {t(caveatKey(pack.caveat))}
        </p>
      )}
      {job && <JobLine status={job} />}
      <div className="wf-pack__actions">
        {busy ? (
          <Button size="xs" variant="outline" onClick={() => void cancel(packKey(pack.url))}>
            {t('common.cancel')}
          </Button>
        ) : (
          <Button size="xs" variant={installed ? 'ghost' : 'solid'} leftIcon={<DownloadSimple size={12} />} onClick={() => void install(pack.url)} data-testid="wf-pack-install">
            {installed ? t('workflows.packs.reinstall') : t('workflows.packs.install')}
          </Button>
        )}
        {installed && !busy && <RemoveButton folder={installed.folder} />}
      </div>
    </article>
  );
}

function GoalTile({ goal, onPick }: { goal: PackGoalId; onPick: () => void }) {
  const installed = useNodePacks((s) => s.packs?.installed);
  const packs = packsForGoal(goal);
  const have = packs.filter((p) => installed?.some((i) => i.url === packKey(p.url) || i.folder === packFolder(p.url))).length;
  return (
    <button type="button" className="wf-goal" onClick={onPick} data-testid="wf-goal" data-goal={goal}>
      <span className="wf-goal__icon">{GOAL_ICONS[goal]}</span>
      <strong className="wf-goal__title">{t(goalTitleKey(goal))}</strong>
      <span className="wf-goal__desc">{t(goalDescKey(goal))}</span>
      <span className={cx('wf-goal__count', have > 0 && 'is-have')}>{have > 0 ? t('workflows.packs.goalHave', { have, count: packs.length }) : t('workflows.packs.goalCount', { count: packs.length })}</span>
    </button>
  );
}

export function AddByAddress({ onInstalling }: { onInstalling?: () => void } = {}) {
  const [url, setUrl] = useState('');
  const install = useNodePacks((s) => s.install);
  const job = useNodePacks((s) => (url ? s.jobs[packKey(url)] : undefined));
  const valid = /^https:\/\/github\.com\/[\w.-]+\/[\w.-]+\/?$/.test(url.trim());
  return (
    <div className="wf-packs__add">
      <div className="wf-packs__row">
        <TextInput
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder={t('workflows.packs.addressPlaceholder')}
          aria-label={t('workflows.packs.addressLabel')}
          data-testid="wf-pack-url"
        />
        <Button
          size="sm"
          disabled={!valid}
          onClick={() => {
            onInstalling?.();
            void install(url);
          }}
          data-testid="wf-pack-url-install"
        >
          {t('workflows.packs.install')}
        </Button>
      </div>
      {url.trim() && !valid && <p className="wf-ext__note">{t('workflows.packs.mgr.addInvalid')}</p>}
      {job && <JobLine status={job} />}
    </div>
  );
}

export function PacksView() {
  const packs = useNodePacks((s) => s.packs);
  const error = useNodePacks((s) => s.error);
  const restarting = useNodePacks((s) => s.restarting);
  const load = useNodePacks((s) => s.load);
  const restart = useNodePacks((s) => s.restart);
  const ask = useAgent((s) => s.send);
  const openAgent = useAgent((s) => s.setOpen);
  const [goal, setGoal] = useState<PackGoalId | null>(null);
  useEffect(() => {
    void load();
  }, [load]);

  const installed = packs?.installed ?? [];
  const others = installed.filter((i) => !PACK_CATALOG.some((p) => i.url === packKey(p.url) || i.folder === packFolder(p.url)));
  return (
    <div className="wf-packs" data-testid="wf-packs">
      {packs && !packs.available && <p className="wf-packs__notice">{t('workflows.packs.unavailable')}</p>}
      {packs?.restartNeeded && (
        <div className="wf-packs__restart" data-testid="wf-packs-restart">
          <span>{t('workflows.packs.restartNeeded')}</span>
          <Button size="sm" variant="solid" leftIcon={<ArrowClockwise size={14} />} isLoading={restarting} onClick={() => void restart()}>
            {t('workflows.packs.restart')}
          </Button>
        </div>
      )}
      {error && <p className="wf-packs__error">{error}</p>}
      {packs?.available !== false && (
        <>
          {goal ? (
            <>
              <button type="button" className="wf-packs__back" onClick={() => setGoal(null)} data-testid="wf-goal-back">
                <CaretLeft size={12} /> {t('workflows.packs.backToGoals')}
              </button>
              <h3 className="wf-packs__goal">
                {GOAL_ICONS[goal]} {t(goalTitleKey(goal))}
              </h3>
              {packsForGoal(goal).map((p) => (
                <PackCard key={p.id} pack={p} />
              ))}
            </>
          ) : (
            <>
              <h3 className="wf-packs__title">{t('workflows.packs.whatToDo')}</h3>
              <div className="wf-goals">
                {PACK_GOALS.map((g) => (
                  <GoalTile key={g} goal={g} onPick={() => setGoal(g)} />
                ))}
              </div>
              <button
                type="button"
                className="wf-packs__ask"
                onClick={() => {
                  openAgent(true);
                  void ask(t('workflows.packs.askMessage'));
                }}
                data-testid="wf-packs-ask"
              >
                <Sparkle size={18} weight="fill" />
                <strong>{t('workflows.packs.askTitle')}</strong>
              </button>
              <h3 className="wf-packs__title">{t('workflows.packs.byAddress')}</h3>
              <AddByAddress />
              {others.length > 0 && (
                <>
                  <h3 className="wf-packs__title">{t('workflows.packs.others')}</h3>
                  {others.map((p) => (
                    <div key={p.folder} className="wf-packs__other">
                      <span>{p.folder}</span>
                      <RemoveButton folder={p.folder} />
                    </div>
                  ))}
                </>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
