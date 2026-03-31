import React, { ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCcw, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: string | null;
}

export default class ErrorBoundary extends React.Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
    
    // Try to parse the error message if it's our custom JSON string
    let detailedInfo = null;
    try {
      detailedInfo = JSON.parse(error.message);
    } catch (e) {
      // Not our custom JSON error
    }

    this.setState({
      error,
      errorInfo: detailedInfo ? JSON.stringify(detailedInfo, null, 2) : error.message
    });
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.href = '/';
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 font-sans">
          <div className="w-full max-w-md bg-white rounded-3xl shadow-xl overflow-hidden border border-slate-100">
            <div className="p-8 text-center">
              <div className="w-20 h-20 bg-rose-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <AlertTriangle className="w-10 h-10 text-rose-600" />
              </div>
              
              <h1 className="text-2xl font-bold text-slate-900 mb-2">Something went wrong</h1>
              <p className="text-slate-500 mb-8">
                We encountered an unexpected error. Please try refreshing or returning home.
              </p>

              <div className="bg-slate-50 rounded-2xl p-4 mb-8 text-left overflow-hidden">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Error Details</p>
                <div className="max-h-40 overflow-y-auto">
                  <pre className="text-[10px] text-rose-600 font-mono whitespace-pre-wrap break-all">
                    {this.state.errorInfo || 'An unknown error occurred.'}
                  </pre>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => window.location.reload()}
                  className="flex items-center justify-center gap-2 py-3.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl font-bold transition-all active:scale-95"
                >
                  <RefreshCcw className="w-5 h-5" />
                  <span>Refresh</span>
                </button>
                <button
                  onClick={this.handleReset}
                  className="flex items-center justify-center gap-2 py-3.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-bold shadow-lg shadow-indigo-200 transition-all active:scale-95"
                >
                  <Home className="w-5 h-5" />
                  <span>Home</span>
                </button>
              </div>
            </div>
            
            <div className="bg-slate-50 p-4 text-center border-t border-slate-100">
              <p className="text-xs text-slate-400 font-medium">
                If the problem persists, please contact support.
              </p>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
