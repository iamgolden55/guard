import ReactDOM from 'react-dom/client';
import App from './App';
import { initMonitoring } from './lib/monitoring';
import './index.css';

// Initialize monitoring (Sentry + PostHog) — no-ops if env vars are empty
initMonitoring();

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Failed to find root element');
}

ReactDOM.createRoot(rootElement).render(<App />);
