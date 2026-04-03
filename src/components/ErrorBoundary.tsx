import React, { ErrorInfo, ReactNode } from 'react';
import { ShieldAlert, RefreshCcw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends React.Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-black flex items-center justify-center p-6 text-center">
          <div className="max-w-md w-full bg-zinc-900 border border-white/10 p-12 rounded-[3rem] shadow-2xl">
            <div className="w-20 h-20 bg-red-500/20 rounded-3xl flex items-center justify-center mx-auto mb-8">
              <ShieldAlert className="w-10 h-10 text-red-500" />
            </div>
            <h2 className="text-3xl font-bold text-white mb-4">System Error</h2>
            <p className="text-zinc-500 mb-8">
              Something went wrong. The Rahee realm is temporarily unstable.
            </p>
            <div className="bg-black/50 p-4 rounded-2xl mb-8 text-left overflow-auto max-h-32">
              <code className="text-xs text-red-400 font-mono">
                {this.state.error?.message}
              </code>
            </div>
            <button
              onClick={() => window.location.reload()}
              className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-bold py-4 rounded-2xl transition-all flex items-center justify-center gap-2"
            >
              <RefreshCcw className="w-5 h-5" />
              Reload Game
            </button>
          </div>
        </div>
      );
    }

    return (this as any).props.children;
  }
}
