import { useParams, Link } from 'react-router-dom';
import { Header } from '../components/layout/Header';
import { OptionsLadder } from '../components/options/OptionsLadder';
import { TimeSales } from '../components/options/TimeSales';
import { ArrowLeft, Settings, AlertTriangle } from 'lucide-react';
import { useState } from 'react';

export function OptionsLadderPage() {
  const { symbol } = useParams<{ symbol: string }>();
  const [showSettings, setShowSettings] = useState(false);
  const [sweepThreshold, setSweepThreshold] = useState(50);

  if (!symbol) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-white mb-2">Symbol not found</h1>
          <Link
            to="/"
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded font-medium transition-colors"
          >
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900">
      <Header />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-4">
            <Link
              to="/"
              className="bg-gray-800 hover:bg-gray-700 text-white p-2 rounded-lg transition-colors"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-white">{symbol}</h1>
              <p className="text-gray-400">Options Ladder & Time & Sales</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            <div className="bg-gray-800 rounded-lg p-2">
              <div className="text-xs text-gray-400">Sweep Threshold</div>
              <div className="text-white font-bold">{sweepThreshold} contracts</div>
            </div>
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="bg-gray-800 hover:bg-gray-700 text-white p-2 rounded-lg transition-colors"
            >
              <Settings className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Settings Panel */}
        {showSettings && (
          <div className="bg-gray-800 rounded-lg p-4 mb-6 border border-gray-700">
            <h3 className="text-white font-semibold mb-4">Alert Settings</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm text-gray-400 mb-2">
                  Sweep Alert Threshold
                </label>
                <input
                  type="number"
                  value={sweepThreshold}
                  onChange={(e) => setSweepThreshold(Number(e.target.value))}
                  className="w-full bg-gray-700 text-white px-3 py-2 rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
                  min="10"
                  max="500"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-2">
                  Sound Alerts
                </label>
                <select className="w-full bg-gray-700 text-white px-3 py-2 rounded border border-gray-600 focus:border-blue-500 focus:outline-none">
                  <option value="on">On</option>
                  <option value="off">Off</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-2">
                  Update Speed
                </label>
                <select className="w-full bg-gray-700 text-white px-3 py-2 rounded border border-gray-600 focus:border-blue-500 focus:outline-none">
                  <option value="100">100ms</option>
                  <option value="250">250ms</option>
                  <option value="500">500ms</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column - Options Ladder */}
          <div>
            <OptionsLadder symbol={symbol} />
          </div>

          {/* Right Column - Time & Sales */}
          <div>
            <TimeSales symbol={symbol} />
          </div>
        </div>

        {/* Additional Info */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-gray-800 rounded-lg p-4">
            <h4 className="text-white font-semibold mb-2">Contract Info</h4>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">Symbol:</span>
                <span className="text-white">{symbol}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Type:</span>
                <span className="text-white">{symbol.includes('C') ? 'Call' : 'Put'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Expiry:</span>
                <span className="text-white">2024-12-13</span>
              </div>
            </div>
          </div>

          <div className="bg-gray-800 rounded-lg p-4">
            <h4 className="text-white font-semibold mb-2">Market Stats</h4>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">Volume:</span>
                <span className="text-white">1,250</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Open Interest:</span>
                <span className="text-white">8,500</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">IV:</span>
                <span className="text-white">22.5%</span>
              </div>
            </div>
          </div>

          <div className="bg-gray-800 rounded-lg p-4">
            <h4 className="text-white font-semibold mb-2">Greeks</h4>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">Delta:</span>
                <span className="text-white">0.45</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Gamma:</span>
                <span className="text-white">0.0023</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Theta:</span>
                <span className="text-white">-0.15</span>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}