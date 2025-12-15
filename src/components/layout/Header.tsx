import { useState, useEffect } from 'react';
import { BarChart3, TrendingUp, Settings, Bell, Clock, Languages } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

export function Header() {
  const location = useLocation();
  const { t, i18n } = useTranslation();
  const [marketStatus, setMarketStatus] = useState<{ isOpen: boolean; text: string; next: string }>({
    isOpen: false,
    text: t('CHECKING'),
    next: ''
  });

  useEffect(() => {
    const checkMarketStatus = () => {
      const now = new Date();
      // Get NY Time
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/New_York',
        hour: 'numeric',
        minute: 'numeric',
        hour12: false,
        weekday: 'long'
      });

      const parts = formatter.formatToParts(now);
      const getPart = (type: string) => parts.find(p => p.type === type)?.value;

      const hour = parseInt(getPart('hour') || '0');
      const minute = parseInt(getPart('minute') || '0');
      const weekday = getPart('weekday');

      const currentTimeVals = hour * 60 + minute;
      const marketOpen = 9 * 60 + 30; // 9:30 AM
      const marketClose = 16 * 60;    // 4:00 PM

      const isWeekend = weekday === 'Saturday' || weekday === 'Sunday';
      const isMarketHours = currentTimeVals >= marketOpen && currentTimeVals < marketClose;

      if (!isWeekend && isMarketHours) {
        setMarketStatus({ isOpen: true, text: t('MARKET OPEN'), next: 'Closes at 4:00 PM ET' });
      } else {
        setMarketStatus({ isOpen: false, text: t('MARKET CLOSED'), next: 'Opens 9:30 AM ET' });
      }
    };

    checkMarketStatus();
    const interval = setInterval(checkMarketStatus, 10000); // Update every 10s
    return () => clearInterval(interval);
  }, [t]);

  const navItems = [
    { path: '/', label: t('Dashboard'), icon: BarChart3 },
    { path: '/scanner', label: t('Scanner'), icon: TrendingUp },
    { path: '/watchlist', label: t('Watchlist'), icon: Bell },
    { path: '/backtest', label: t('Backtest'), icon: Clock },
    { path: '/settings', label: t('Settings'), icon: Settings },
  ];

  return (
    <header className="bg-gray-900 border-b border-gray-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center">
            <Link to="/" className="flex items-center space-x-2">
              <BarChart3 className="h-8 w-8 text-green-500" />
              <span className="text-xl font-bold text-white">TapeReading</span>
            </Link>
          </div>

          <nav className="flex space-x-4">
            {navItems.map(({ path, label, icon: Icon }) => {
              const isActive = location.pathname === path;
              return (
                <Link
                  key={path}
                  to={path}
                  className={`
                    flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors
                    ${isActive
                      ? 'bg-gray-800 text-white'
                      : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                    }
                  `}
                >
                  <Icon className="h-4 w-4" />
                  <span>{label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center space-x-6">
            {/* Market Status Widget */}
            <div className={`flex flex-col items-end px-3 py-1 rounded border ${marketStatus.isOpen ? 'bg-green-900/20 border-green-800' : 'bg-gray-800 border-gray-700'}`}>
              <div className="flex items-center space-x-2">
                <div className={`w-2 h-2 rounded-full ${marketStatus.isOpen ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
                <span className={`text-xs font-bold ${marketStatus.isOpen ? 'text-green-400' : 'text-gray-400'}`}>
                  {marketStatus.text}
                </span>
              </div>
              <span className="text-[10px] text-gray-500">{marketStatus.next}</span>
            </div>

            {/* Language Selector */}
            <div className="flex items-center space-x-2">
              <Languages className="h-4 w-4 text-gray-400" />
              <select
                value={i18n.language}
                onChange={(e) => i18n.changeLanguage(e.target.value)}
                className="bg-gray-800 text-gray-300 text-sm border border-gray-700 rounded px-2 py-1 focus:outline-none focus:border-blue-500"
              >
                <option value="en">English</option>
                <option value="es">Español</option>
              </select>
            </div>

            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-400">v1.2</span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}