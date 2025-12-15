import { useEffect, useState } from 'react';
import { Header } from '../components/layout/Header';
import { Save, Bell, Key, Volume2, RefreshCw } from 'lucide-react';
import axios from 'axios';
import { useTranslation } from 'react-i18next';

export function Settings() {
  const { t } = useTranslation();
  const [settings, setSettings] = useState({
    // Alert Settings
    sweepThreshold: 50,
    volumeAlertThreshold: 3.0,
    enableSoundAlerts: true,
    enableVisualAlerts: true,
    alertPosition: 'top-right' as 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left',

    // API Settings
    schwabAppKey: '',
    schwabSecret: '',

    // Display Settings
    updateSpeed: 100,
    darkMode: true,
    showGreeks: true,
    showVolumeProfile: true,

    // Scanner Settings
    minRVOL: 2.0,
    minDollarVolume: 50000000,
    maxStocks: 50
  });

  const [saved, setSaved] = useState(false);
  const [schwabConnected, setSchwabConnected] = useState(false);
  const [manualTokens, setManualTokens] = useState({ access_token: '', refresh_token: '' });
  const [authUrl, setAuthUrl] = useState('');
  const [redirectInput, setRedirectInput] = useState('');
  const [codeInput, setCodeInput] = useState('');

  const apiUrl = import.meta.env.VITE_API_URL || '';

  const handleSave = () => {
    // Save settings to localStorage or API
    localStorage.setItem('tapeReaderSettings', JSON.stringify(settings));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleConnectSchwab = async () => {
    const { data } = await axios.get(`${apiUrl}/api/auth/schwab/login`);
    const url = data.url as string;
    setAuthUrl(url);
    window.open(url, '_blank');
  };

  const handleSetManualTokens = async () => {
    if (!manualTokens.access_token) return;
    await axios.post(`${apiUrl}/api/auth/schwab/token`, manualTokens);
    const { data } = await axios.get(`${apiUrl}/api/health`);
    setSchwabConnected(Boolean(data.schwab_connected));
  };

  const handleExchangeCode = async () => {
    const payload: any = {};
    if (codeInput) payload.code = codeInput;
    if (redirectInput) payload.redirect_url = redirectInput;
    if (!payload.code && !payload.redirect_url) return;
    await axios.post(`${apiUrl}/api/auth/schwab/exchange`, payload);
    const { data } = await axios.get(`${apiUrl}/api/health`);
    setSchwabConnected(Boolean(data.schwab_connected));
  };

  useEffect(() => {
    const checkHealth = async () => {
      try {
        const { data } = await axios.get(`${apiUrl}/api/health`);
        setSchwabConnected(Boolean(data.schwab_connected));
      } catch { }
    };
    checkHealth();
    const id = setInterval(checkHealth, 5000);
    return () => clearInterval(id);
  }, [apiUrl]);

  const handleChange = (key: string, value: any) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  return (
    <div className="min-h-screen bg-gray-900">
      <Header />

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">{t('Settings')}</h1>
          <p className="text-gray-400">{t('Configure preferences')}</p>
        </div>

        {/* Alert Settings */}
        <div className="bg-gray-800 rounded-lg p-6 mb-6">
          <div className="flex items-center mb-4">
            <Bell className="h-5 w-5 text-yellow-500 mr-2" />
            <h2 className="text-xl font-semibold text-white">{t('Alert Settings')}</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm text-gray-400 mb-2">
                {t('Sweep Threshold (contracts)')}
              </label>
              <input
                type="number"
                value={settings.sweepThreshold}
                onChange={(e) => handleChange('sweepThreshold', Number(e.target.value))}
                className="w-full bg-gray-700 text-white px-3 py-2 rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
                min="10"
                max="500"
              />
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-2">
                {t('Volume Alert Threshold (RVOL)')}
              </label>
              <input
                type="number"
                step="0.1"
                value={settings.volumeAlertThreshold}
                onChange={(e) => handleChange('volumeAlertThreshold', Number(e.target.value))}
                className="w-full bg-gray-700 text-white px-3 py-2 rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
                min="1"
                max="10"
              />
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-2">
                {t('Alert Position')}
              </label>
              <select
                value={settings.alertPosition}
                onChange={(e) => handleChange('alertPosition', e.target.value)}
                className="w-full bg-gray-700 text-white px-3 py-2 rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
              >
                <option value="top-right">{t('Top Right')}</option>
                <option value="top-left">{t('Top Left')}</option>
                <option value="bottom-right">{t('Bottom Right')}</option>
                <option value="bottom-left">{t('Bottom Left')}</option>
              </select>
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-2">
                {t('Update Speed (ms)')}
              </label>
              <select
                value={settings.updateSpeed}
                onChange={(e) => handleChange('updateSpeed', Number(e.target.value))}
                className="w-full bg-gray-700 text-white px-3 py-2 rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
              >
                <option value={100}>100ms ({t('Fast')})</option>
                <option value={250}>250ms ({t('Medium')})</option>
                <option value={500}>500ms ({t('Slow')})</option>
              </select>
            </div>
          </div>

          <div className="flex items-center space-x-6 mt-4">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={settings.enableSoundAlerts}
                onChange={(e) => handleChange('enableSoundAlerts', e.target.checked)}
                className="mr-2"
              />
              <span className="text-gray-300">{t('Enable Sound Alerts')}</span>
            </label>

            <label className="flex items-center">
              <input
                type="checkbox"
                checked={settings.enableVisualAlerts}
                onChange={(e) => handleChange('enableVisualAlerts', e.target.checked)}
                className="mr-2"
              />
              <span className="text-gray-300">{t('Enable Visual Alerts')}</span>
            </label>
          </div>
        </div>

        {/* API Settings */}
        <div className="bg-gray-800 rounded-lg p-6 mb-6">
          <div className="flex items-center mb-4">
            <Key className="h-5 w-5 text-blue-500 mr-2" />
            <h2 className="text-xl font-semibold text-white">{t('API Configuration')}</h2>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-2">
                {t('Schwab App Key')}
              </label>
              <input
                type="password"
                value={settings.schwabAppKey}
                onChange={(e) => handleChange('schwabAppKey', e.target.value)}
                className="w-full bg-gray-700 text-white px-3 py-2 rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
                placeholder={t('Enter Schwab App Key')}
              />
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-2">
                {t('Schwab App Secret')}
              </label>
              <input
                type="password"
                value={settings.schwabSecret}
                onChange={(e) => handleChange('schwabSecret', e.target.value)}
                className="w-full bg-gray-700 text-white px-3 py-2 rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
                placeholder={t('Enter Schwab App Secret')}
              />
            </div>

            <div className="text-xs text-gray-500">
              {t('API stored locally')}
            </div>

            <div className="mt-4 flex items-center justify-between">
              <button
                onClick={handleConnectSchwab}
                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg"
              >
                {t('Connect Schwab')}
              </button>
              <button
                onClick={async () => {
                  const mockTokens = { access_token: 'mock-dev-token', refresh_token: 'mock-refresh-token' };
                  setManualTokens(mockTokens);

                  try {
                    await axios.post(`${apiUrl}/api/auth/schwab/token`, mockTokens);
                    // Small delay to ensure backend updates
                    await new Promise(r => setTimeout(r, 500));
                    const { data } = await axios.get(`${apiUrl}/api/health`);
                    setSchwabConnected(Boolean(data.schwab_connected));
                    setSaved(true);
                    setTimeout(() => setSaved(false), 2000);
                  } catch (e) {
                    console.error("Dev login failed", e);
                  }
                }}
                className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg ml-2"
              >
                {t('Login (Dev Mode)')}
              </button>
              <span className={schwabConnected ? 'text-green-400' : 'text-red-400'}>
                {schwabConnected ? t('Connected') : t('Disconnected')}
              </span>
            </div>

            {authUrl && (
              <div className="mt-3 text-xs text-gray-400 break-all">
                {t('Auth URL')}
                <div className="mt-1 p-2 bg-gray-700 rounded text-gray-200">{authUrl}</div>
              </div>
            )}

            <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-1">
                <label className="block text-sm text-gray-400 mb-2">{t('Code')}</label>
                <input
                  type="text"
                  value={codeInput}
                  onChange={(e) => setCodeInput(e.target.value)}
                  className="w-full bg-gray-700 text-white px-3 py-2 rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
                  placeholder={t('Paste code')}
                />
              </div>
              <div className="md:col-span-1">
                <label className="block text-sm text-gray-400 mb-2">{t('Redirect URL')}</label>
                <input
                  type="text"
                  value={redirectInput}
                  onChange={(e) => setRedirectInput(e.target.value)}
                  className="w-full bg-gray-700 text-white px-3 py-2 rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
                  placeholder="https://127.0.0.1:8001/?code=...&state=..."
                />
              </div>
              <div className="md:col-span-1 flex items-end">
                <button
                  onClick={handleExchangeCode}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg"
                >
                  {t('Exchange Code')}
                </button>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-1">
                <label className="block text-sm text-gray-400 mb-2">{t('Access Token')}</label>
                <input
                  type="password"
                  value={manualTokens.access_token}
                  onChange={(e) => setManualTokens(prev => ({ ...prev, access_token: e.target.value }))}
                  className="w-full bg-gray-700 text-white px-3 py-2 rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
                  placeholder={t('Paste access token')}
                />
              </div>
              <div className="md:col-span-1">
                <label className="block text-sm text-gray-400 mb-2">{t('Refresh Token')}</label>
                <input
                  type="password"
                  value={manualTokens.refresh_token}
                  onChange={(e) => setManualTokens(prev => ({ ...prev, refresh_token: e.target.value }))}
                  className="w-full bg-gray-700 text-white px-3 py-2 rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
                  placeholder={t('Optional')}
                />
              </div>
              <div className="md:col-span-1 flex items-end">
                <button
                  onClick={handleSetManualTokens}
                  className="w-full bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg"
                >
                  {t('Use Manual Tokens')}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Scanner Settings */}
        <div className="bg-gray-800 rounded-lg p-6 mb-6">
          <div className="flex items-center mb-4">
            <RefreshCw className="h-5 w-5 text-green-500 mr-2" />
            <h2 className="text-xl font-semibold text-white">{t('Scanner Settings')}</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm text-gray-400 mb-2">
                {t('Minimum RVOL')}
              </label>
              <input
                type="number"
                step="0.1"
                value={settings.minRVOL}
                onChange={(e) => handleChange('minRVOL', Number(e.target.value))}
                className="w-full bg-gray-700 text-white px-3 py-2 rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
                min="1"
                max="10"
              />
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-2">
                {t('Minimum Dollar Volume')}
              </label>
              <select
                value={settings.minDollarVolume}
                onChange={(e) => handleChange('minDollarVolume', Number(e.target.value))}
                className="w-full bg-gray-700 text-white px-3 py-2 rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
              >
                <option value={10000000}>$10M</option>
                <option value={25000000}>$25M</option>
                <option value={50000000}>$50M</option>
                <option value={100000000}>$100M</option>
                <option value={250000000}>$250M</option>
              </select>
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-2">
                {t('Max Results')}
              </label>
              <input
                type="number"
                value={settings.maxStocks}
                onChange={(e) => handleChange('maxStocks', Number(e.target.value))}
                className="w-full bg-gray-700 text-white px-3 py-2 rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
                min="10"
                max="200"
              />
            </div>
          </div>
        </div>

        {/* Display Settings */}
        <div className="bg-gray-800 rounded-lg p-6 mb-6">
          <div className="flex items-center mb-4">
            <Volume2 className="h-5 w-5 text-purple-500 mr-2" />
            <h2 className="text-xl font-semibold text-white">{t('Display Settings')}</h2>
          </div>

          <div className="flex items-center space-x-6">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={settings.showGreeks}
                onChange={(e) => handleChange('showGreeks', e.target.checked)}
                className="mr-2"
              />
              <span className="text-gray-300">{t('Show Greeks')}</span>
            </label>

            <label className="flex items-center">
              <input
                type="checkbox"
                checked={settings.showVolumeProfile}
                onChange={(e) => handleChange('showVolumeProfile', e.target.checked)}
                className="mr-2"
              />
              <span className="text-gray-300">{t('Show Volume Profile')}</span>
            </label>

            <label className="flex items-center">
              <input
                type="checkbox"
                checked={settings.darkMode}
                onChange={(e) => handleChange('darkMode', e.target.checked)}
                className="mr-2"
              />
              <span className="text-gray-300">{t('Dark Mode')}</span>
            </label>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end">
          <button
            onClick={handleSave}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium transition-colors flex items-center"
          >
            <Save className="h-4 w-4 mr-2" />
            {saved ? t('Saved!') : t('Save Settings')}
          </button>
        </div>
      </main>
    </div>
  );
}
