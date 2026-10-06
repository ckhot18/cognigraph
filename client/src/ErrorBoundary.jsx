import { Component } from 'react';

// Friendly retry card instead of a blank screen when a mode crashes (spec 9).
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-6 text-sm text-red-200" role="alert">
          <p className="font-semibold">Something went wrong rendering {this.props.name ?? 'this view'}.</p>
          <p className="mt-1">Try resetting the demo — your seeded data is safe.</p>
          <button
            type="button"
            onClick={() => this.setState({ error: null })}
            className="mt-3 rounded-lg border border-red-400/50 px-3 py-1.5 text-red-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-300"
          >
            Retry
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
