import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Dashboard } from './pages/Dashboard';
import { OptionsLadderPage } from './pages/OptionsLadder';
import { SwingScanner } from './pages/SwingScanner';
import { Watchlist } from './pages/Watchlist';
import { Backtest } from './pages/Backtest';
import { Settings } from './pages/Settings';
import { StreamMarketEngine } from './pages/StreamMarketEngine';
import { Signals } from './pages/Signals';
import { Calendar } from './pages/Calendar';
import { Academy } from './pages/Academy';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/ladder/:symbol" element={<OptionsLadderPage />} />
        <Route path="/engine" element={<StreamMarketEngine />} />
        <Route path="/academy" element={<Academy />} />
        <Route path="/signals" element={<Signals />} />
        <Route path="/calendar" element={<Calendar />} />
        <Route path="/watchlist" element={<Watchlist />} />
        <Route path="/backtest" element={<Backtest />} />
        <Route path="/settings" element={<Settings />} />
      </Routes>
    </Router>
  );
}

export default App;