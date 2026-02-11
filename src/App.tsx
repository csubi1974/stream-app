import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Dashboard } from './pages/Dashboard';
import { OptionsLadderPage } from './pages/OptionsLadder';
import { SwingScanner } from './pages/SwingScanner';
import { Backtest } from './pages/Backtest';
import { Settings } from './pages/Settings';
import { IntelligenceHub } from './pages/IntelligenceHub';
import { Signals } from './pages/Signals';
import { Calendar } from './pages/Calendar';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/ladder/:symbol" element={<OptionsLadderPage />} />
        <Route path="/intelligence" element={<IntelligenceHub />} />
        <Route path="/academy" element={<IntelligenceHub />} />
        <Route path="/engine" element={<IntelligenceHub />} />
        <Route path="/signals" element={<Signals />} />
        <Route path="/calendar" element={<Calendar />} />
        <Route path="/backtest" element={<Backtest />} />
        <Route path="/settings" element={<Settings />} />
      </Routes>
    </Router>
  );
}

export default App;