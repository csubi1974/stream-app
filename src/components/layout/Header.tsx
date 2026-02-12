import { useState, useEffect } from 'react';
import { BarChart3, TrendingUp, Settings, Bell, Clock, Languages, Zap, Target, Calendar, BookOpen } from 'lucide-react';
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
        setMarketStatus({ isOpen: true, text: t('MARKET OPEN'), next: t('Closes at 4:00 PM ET') });
      } else {
        setMarketStatus({ isOpen: false, text: t('MARKET CLOSED'), next: t('Opens 9:30 AM ET') });
      }
    };

    checkMarketStatus();
    const interval = setInterval(checkMarketStatus, 10000); // Update every 10s
    return () => clearInterval(interval);
  }, [t]);

  const navItems = [
    { path: '/', label: t('Dashboard'), icon: BarChart3 },
    { path: '/intelligence', label: t('Intelligence Hub'), icon: BookOpen },
    { path: '/signals', label: t('Signals'), icon: Target },
    { path: '/calendar', label: t('Calendar'), icon: Calendar },
    { path: '/backtest', label: t('Backtest'), icon: Clock },
    { path: '/settings', label: t('Settings'), icon: Settings },
  ];

  return (
    <header className="glass-surface sticky top-0 z-50 border-b border-white/[0.05]">
      <div className="max-w-[1600px] mx-auto px-6">
        <div className="flex items-center justify-between h-14">
          <div className="flex items-center mr-12">
            <Link to="/" className="flex items-center space-x-3 group transition-all">
              <div className="p-1.5 bg-accent/10 rounded-lg group-hover:bg-accent/20 transition-colors border border-accent/20">
                <Zap className="h-5 w-5 text-accent" />
              </div>
              <span className="text-lg font-black tracking-tighter text-white uppercase italic">
                STREAM<span className="text-accent">.</span>FLOW
              </span>
            </Link>
          </div>

          <nav className="hidden lg:flex items-center space-x-1">
            {navItems.map(({ path, label, icon: Icon }) => {
              const isActive = location.pathname === path;
              return (
                <Link
                  key={path}
                  to={path}
                  className={`
                    flex items-center space-x-2 px-4 py-1.5 rounded-full text-xs font-semibold tracking-wide transition-all
                    ${isActive
                      ? 'bg-accent/10 text-accent border border-accent/20 shadow-[0_0_15px_rgba(0,242,255,0.1)]'
                      : 'text-ink-secondary hover:text-white hover:bg-white/5'
                    }
                  `}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span className="uppercase">{label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center space-x-4">
            {/* Market Status Widget */}
            <div className={`flex items-center space-x-3 px-3 py-1.5 rounded-lg border transition-all ${marketStatus.isOpen ? 'bg-green-500/10 border-green-500/20' : 'bg-red-500/10 border-red-500/20'}`}>
              <div className="flex items-center space-x-2">
                <div className={`w-1.5 h-1.5 rounded-full shadow-[0_0_8px] ${marketStatus.isOpen ? 'bg-green-500 shadow-green-500/50 animate-pulse' : 'bg-red-500 shadow-red-500/50'}`}></div>
                <span className={`text-[10px] font-black uppercase tracking-widest ${marketStatus.isOpen ? 'text-green-400' : 'text-red-400'}`}>
                  {marketStatus.text}
                </span>
              </div>
              <span className="text-[9px] text-gray-400 data-font font-medium pt-0.5">{marketStatus.next}</span>
            </div>

            {/* Language Selector */}
            <button
              onClick={() => {
                const newLang = i18n.language === 'en' ? 'es' : 'en';
                i18n.changeLanguage(newLang);
              }}
              className="flex items-center space-x-2 px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg transition-all group"
            >
              <span className="text-sm">
                {i18n.language === 'en' ? '🇺🇸' : '🇪🇸'}
              </span>
              <span className="text-[10px] font-black text-ink-secondary group-hover:text-white data-font">
                {i18n.language === 'en' ? 'EN' : 'ES'}
              </span>
            </button>

            <div className="flex items-center border-l border-white/10 pl-4 h-6">
              <span className="text-[9px] text-ink-muted data-font font-bold uppercase tracking-tighter tabular-nums">v1.16.9</span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}