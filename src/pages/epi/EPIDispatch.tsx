import { Component, type ReactNode } from 'react';
import { ModuleDispatchView } from '@/components/modules/ModuleDispatchView';
import { epiDispatchConfig } from '@/pages/epi/epiDispatchConfig';

class EPIErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(error: Error, info: any) {
    console.error('[EPIDispatch crash]', error, info?.componentStack);
  }
  render() {
    if (this.state.error) {
      return (
        <div className="p-8 max-w-xl mx-auto mt-20">
          <h2 className="text-lg font-bold text-red-600 mb-2">Erreur module EPI</h2>
          <pre className="text-xs bg-red-50 p-4 rounded overflow-auto whitespace-pre-wrap text-red-800">
            {this.state.error.message}
            {'\n\n'}
            {this.state.error.stack}
          </pre>
          <button className="mt-4 px-4 py-2 bg-primary text-white rounded" onClick={() => this.setState({ error: null })}>
            Réessayer
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function EPIDispatch() {
  return (
    <EPIErrorBoundary>
      <ModuleDispatchView config={epiDispatchConfig} />
    </EPIErrorBoundary>
  );
}
