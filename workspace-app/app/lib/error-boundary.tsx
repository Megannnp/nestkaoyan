"use client";

import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 m-4 rounded-lg bg-red-50 border border-red-200">
          <h2 className="text-lg font-bold text-red-800 mb-2">页面渲染错误</h2>
          <p className="text-sm text-red-600 mb-3">请联系开发者或刷新页面重试。</p>
          <details className="text-xs text-red-500">
            <summary className="cursor-pointer font-semibold">错误详情</summary>
            <pre className="mt-2 p-2 rounded bg-red-100 overflow-auto max-h-[200px]">
              {this.state.error?.message}
              {"\n"}
              {this.state.error?.stack}
            </pre>
          </details>
          <button
            className="mt-3 px-4 py-2 rounded bg-red-600 text-white text-sm font-bold hover:bg-red-700"
            onClick={() => { this.setState({ hasError: false, error: null }); window.location.reload(); }}
          >
            刷新页面
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}