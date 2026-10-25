// Read-only JSON of the current workflow.
import { Copy } from '@phosphor-icons/react';
import { useMemo } from 'react';
import { t } from '@/i18n';
import { toast } from '@/state/toasts';
import { useWorkflows } from '@/state/workflows/workflows';
import { Button, writeClipboardText } from '@/ui';
import { serializeWorkflow } from './serialize';

export function DataView() {
  const nodes = useWorkflows((s) => s.nodes);
  const edges = useWorkflows((s) => s.edges);
  const meta = useWorkflows((s) => s.meta);
  const form = useWorkflows((s) => s.form);
  const json = useMemo(() => JSON.stringify(serializeWorkflow({ nodes, edges, meta, form }), null, 2), [nodes, edges, meta, form]);
  return (
    <div className="wf-data">
      <Button
        size="xs"
        leftIcon={<Copy size={12} />}
        onClick={() => {
          writeClipboardText(json).then(
            () => toast({ status: 'success', title: t('workflows.toasts.copiedJson') }),
            () => toast({ status: 'error', title: t('gallery.toast.copyFailed') }),
          );
        }}
      >
        {t('common.copy')}
      </Button>
      <pre className="wf-data__json" data-testid="wf-data-json">
        {json}
      </pre>
    </div>
  );
}
