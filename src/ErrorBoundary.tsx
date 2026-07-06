import { Component, type ErrorInfo, type ReactNode } from "react";
import { STORAGE_KEY } from "./state/storage";

type Props = { children: ReactNode };
type State = { hasError: boolean };

/**
 * Last-resort backstop for render crashes (e.g. a corrupted day entry that
 * slipped past storage sanitization). Keeps the failure calm and gives the
 * user a way out instead of a silent white screen.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: unknown, info: ErrorInfo): void {
    console.error("ErrorBoundary: caught a render error", error, info.componentStack);
  }

  private tryAgain = (): void => {
    window.location.reload();
  };

  private resetData = (): void => {
    if (confirm("Reset all app data on this device? Export a backup first if you want to keep it.")) {
      // Only the main record — never touch the ".corrupt-*" recovery copies.
      localStorage.removeItem(STORAGE_KEY);
      window.location.reload();
    }
  };

  render(): ReactNode {
    if (!this.state.hasError) return this.props.children;
    return (
      <section className="card" role="alert">
        <h2>Something went wrong displaying your data</h2>
        <p className="muted">
          The app hit an unexpected error and stopped. Nothing on this device has been erased.
        </p>
        <button className="primary-btn" onClick={this.tryAgain}>
          Try again
        </button>
        <div style={{ height: 8 }} />
        <button className="danger-btn" onClick={this.resetData}>
          Reset app data
        </button>
      </section>
    );
  }
}
