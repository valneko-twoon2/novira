// Keeps a failed render inside its area: the rest of the app stays usable, the error goes to the developer log,
// and the area offers to try again. Wrap each independent region (panels, main views, dialogs, the whole app).
import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Warning } from '@phosphor-icons/react';
import { t } from '@/i18n';
import { describeError, devLog } from '@/state/devLog';
import { Button } from './controls';

interface Props {
  /** Name of the area, for the log ("left panel", "viewer", ...). Not shown to the user. */
  area: string;
  children: ReactNode;
  /** When any of these change, a failed area tries rendering again (e.g. the open tab). */
  resetKeys?: unknown[];
  /** `screen` fills the window (the outermost boundary); `panel` fits the area. */
  variant?: 'panel' | 'screen';
}

interface State {
  error: unknown;
  keys: unknown[] | undefined;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, keys: this.props.resetKeys };

  static getDerivedStateFromError(error: unknown): Partial<State> {
    return { error: error ?? new Error('unknown') };
  }

  static getDerivedStateFromProps(props: Props, state: State): Partial<State> | null {
    const a = props.resetKeys ?? [];
    const b = state.keys ?? [];
    const changed = a.length !== b.length || a.some((k, i) => !Object.is(k, b[i]));
    return changed ? { keys: props.resetKeys, error: null } : null;
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    devLog('error', `render: ${this.props.area}`, `${describeError(error, true)}${info.componentStack ?? ''}`);
  }

  private retry = () => this.setState({ error: null });

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className={`ui-crash ui-crash--${this.props.variant ?? 'panel'}`} role="alert" data-testid="error-boundary">
        <Warning size={28} />
        <p className="ui-crash__title">{t('common.error.areaFailed')}</p>
        <p className="ui-crash__detail">{describeError(this.state.error)}</p>
        <div className="ui-crash__actions">
          <Button size="sm" variant="outline" onClick={this.retry}>
            {t('common.error.retry')}
          </Button>
          {this.props.variant === 'screen' && (
            <Button size="sm" variant="outline" onClick={() => location.reload()}>
              {t('common.error.reload')}
            </Button>
          )}
        </div>
      </div>
    );
  }
}
