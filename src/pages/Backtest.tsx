
import { useState, useEffect } from 'react';
import { Header } from '../components/layout/Header';
import { Database, PlayCircle, Calendar, Download, TrendingUp, TrendingDown, Clock, ShieldCheck, AlertCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { clsx } from 'clsx';

export function Backtest() {
    const { t } = useTranslation();
    const [symbol, setSymbol] = useState('QQQ'); // Default to QQQ as we know it has data in JSON fallback
    const [dbStats, setDbStats] = useState<any>(null);
    const [isRunning, setIsRunning] = useState(false);
    const [results, setResults] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);

    const API_BASE = '/api';

    const fetchStats = async (selectedSymbol: string) => {
        try {
            const response = await axios.get(`${API_BASE}/backtest/stats/${selectedSymbol}`);
            setDbStats(response.data);
            setError(null);
        } catch (err: any) {
            console.error('Failed to fetch stats:', err);
            setError('Failed to load database stats');
        }
    };

    useEffect(() => {
        fetchStats(symbol);
    }, [symbol]);

    const runSimulation = async () => {
        setIsRunning(true);
        setResults(null);
        setError(null);
        try {
            const response = await axios.post(`${API_BASE}/backtest/run`, { symbol });
            setResults(response.data);
            setIsRunning(false);
        } catch (err: any) {
            console.error('Simulation failed:', err);
            setError(err.response?.data?.error || 'Simulation failed');
            setIsRunning(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-900 text-gray-100">
            <Header />

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="flex justify-between items-end mb-8">
                    <div>
                        <h1 className="text-3xl font-bold text-white mb-2">{t('Backtest Engine')}</h1>
                        <p className="text-gray-400">{t('Validate trading strategies against historical market data')}</p>
                    </div>
                    <div className="flex space-x-2">
                        {['$SPX', 'QQQ', 'SPY'].map(s => (
                            <button
                                key={s}
                                onClick={() => setSymbol(s)}
                                className={clsx(
                                    "px-4 py-2 rounded-md font-medium transition-all",
                                    symbol === s
                                        ? "bg-blue-600 text-white shadow-lg shadow-blue-900/40"
                                        : "bg-gray-800 text-gray-400 hover:bg-gray-700"
                                )}
                            >
                                {s}
                            </button>
                        ))}
                    </div>
                </div>

                {error && (
                    <div className="mb-6 bg-red-900/30 border border-red-500/50 p-4 rounded-lg flex items-center text-red-200">
                        <AlertCircle className="h-5 w-5 mr-2" />
                        {error}
                    </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    {/* Data Status */}
                    <div className="bg-gray-800/50 backdrop-blur-md rounded-xl p-6 border border-gray-700 flex flex-col justify-between">
                        <div>
                            <div className="flex items-center mb-4">
                                <Database className="h-5 w-5 text-blue-400 mr-2" />
                                <h3 className="font-semibold text-white">{t('Data Availability')}</h3>
                            </div>
                            <div className="space-y-4">
                                <div>
                                    <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">{t('Total Snapshots')}</div>
                                    <div className="text-3xl font-bold text-white font-mono">
                                        {dbStats?.totalSnapshots || 0}
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <div className="text-xs text-gray-500 mb-1">{t('Start')}</div>
                                        <div className="text-sm font-mono text-gray-300">
                                            {dbStats?.firstSnapshot ? new Date(dbStats.firstSnapshot).toLocaleDateString() : '--'}
                                        </div>
                                    </div>
                                    <div>
                                        <div className="text-xs text-gray-500 mb-1">{t('End')}</div>
                                        <div className="text-sm font-mono text-gray-300">
                                            {dbStats?.lastSnapshot ? new Date(dbStats.lastSnapshot).toLocaleDateString() : '--'}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Simulation Control */}
                    <div className="bg-gray-800/50 backdrop-blur-md rounded-xl p-6 border border-blue-500/30 flex flex-col justify-between">
                        <div>
                            <div className="flex items-center mb-4">
                                <PlayCircle className="h-5 w-5 text-blue-400 mr-2" />
                                <h3 className="font-semibold text-white">{t('Run Simulation')}</h3>
                            </div>
                            <p className="text-sm text-gray-400 mb-6 leading-relaxed">
                                {t('Executes current signal logic for all available snapshots and evaluates PnL based on subsequent price action.')}
                            </p>
                        </div>
                        <button
                            onClick={runSimulation}
                            disabled={isRunning || !dbStats?.totalSnapshots}
                            className={clsx(
                                "w-full py-3 rounded-lg font-bold flex items-center justify-center transition-all",
                                isRunning
                                    ? "bg-gray-700 text-gray-500 cursor-not-allowed"
                                    : "bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-500 hover:to-indigo-500 shadow-lg shadow-blue-900/30"
                            )}
                        >
                            {isRunning ? (
                                <div className="flex items-center">
                                    <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin mr-2"></div>
                                    {t('Processing...')}
                                </div>
                            ) : (
                                <>
                                    <PlayCircle className="h-5 w-5 mr-2" />
                                    {t('Start Full Backtest')}
                                </>
                            )}
                        </button>
                    </div>

                    {/* Live Recorder Status */}
                    <div className="bg-gray-800/50 backdrop-blur-md rounded-xl p-6 border border-green-500/20">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="font-semibold text-white flex items-center">
                                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse mr-2"></div>
                                {t('Intraday Recorder')}
                            </h3>
                            <span className="text-[10px] text-green-400 bg-green-500/10 px-2 py-0.5 rounded border border-green-500/20">{t('LIVE')}</span>
                        </div>
                        <div className="space-y-4">
                            <div className="bg-gray-900/40 p-3 rounded-lg">
                                <div className="text-gray-500 text-[10px] uppercase mb-1">{t('Next Cycle')}</div>
                                <div className="text-xs font-mono text-gray-400 italic">Every 5 minutes (Real-time storage)</div>
                            </div>
                            <div className="p-3">
                                <div className="text-gray-500 text-[10px] uppercase mb-1">{t('Recent Records')}</div>
                                <div className="flex items-center text-sm text-white">
                                    <Calendar className="h-4 w-4 mr-2 text-blue-400" />
                                    {dbStats?.lastSnapshot ? new Date(dbStats.lastSnapshot).toLocaleTimeString() : t('Checking...')}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* RESULTS SECTION */}
                {results && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
                        {/* Summary Cards */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
                                <div className="text-gray-500 text-xs mb-1 uppercase">{t('Win Rate')}</div>
                                <div className="text-3xl font-bold text-white">{results.summary.winRate.toFixed(1)}%</div>
                            </div>
                            <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
                                <div className="text-gray-500 text-xs mb-1 uppercase">{t('Total PnL')}</div>
                                <div className={clsx(
                                    "text-3xl font-bold",
                                    results.summary.totalPnL >= 0 ? "text-green-400" : "text-red-400"
                                )}>
                                    ${results.summary.totalPnL.toFixed(0)}
                                </div>
                            </div>
                            <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
                                <div className="text-gray-500 text-xs mb-1 uppercase">{t('Total Trades')}</div>
                                <div className="text-3xl font-bold text-white">{results.summary.totalTrades}</div>
                            </div>
                            <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
                                <div className="text-gray-500 text-xs mb-1 uppercase">{t('W/L Ratio')}</div>
                                <div className="text-3xl font-bold text-white">{results.summary.wins} / {results.summary.losses}</div>
                            </div>
                        </div>

                        {/* Signals Table */}
                        <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
                            <div className="px-6 py-4 border-b border-gray-700 flex justify-between items-center">
                                <h3 className="font-semibold text-white">{t('Simulation Log')}</h3>
                                <button className="text-xs text-blue-400 hover:underline flex items-center">
                                    <Download className="h-3 w-3 mr-1" /> {t('CSV Export')}
                                </button>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-left">
                                    <thead className="bg-gray-900/50 text-gray-500 text-xs uppercase tracking-wider">
                                        <tr>
                                            <th className="px-6 py-3 font-medium">{t('Time')}</th>
                                            <th className="px-6 py-3 font-medium">{t('Strategy')}</th>
                                            <th className="px-6 py-3 font-medium">{t('Entry')}</th>
                                            <th className="px-6 py-3 font-medium">{t('Result')}</th>
                                            <th className="px-6 py-3 font-medium text-right">{t('PnL')}</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-700/50">
                                        {results.signals.length === 0 ? (
                                            <tr>
                                                <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                                                    {t('No signals found during backtest. Market conditions might not have met strategy criteria.')}
                                                </td>
                                            </tr>
                                        ) : (
                                            results.signals.map((sig: any, idx: number) => (
                                                <tr key={idx} className="hover:bg-gray-700/30 transition-colors">
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        <div className="text-sm text-gray-300">{new Date(sig.time).toLocaleDateString()}</div>
                                                        <div className="text-[10px] text-gray-500 font-mono italic">{new Date(sig.time).toLocaleTimeString()}</div>
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        <div className="text-sm font-semibold text-white flex items-center">
                                                            {sig.strategy === 'IRON_CONDOR' ? (
                                                                <ShieldCheck className="h-3 w-3 mr-1.5 text-blue-400" />
                                                            ) : sig.strategy.includes('Reversion') ? (
                                                                <Clock className="h-3 w-3 mr-1.5 text-purple-400" />
                                                            ) : sig.strategy.includes('Bull') ? (
                                                                <TrendingUp className="h-3 w-3 mr-1.5 text-green-400" />
                                                            ) : (
                                                                <TrendingDown className="h-3 w-3 mr-1.5 text-red-400" />
                                                            )}
                                                            {sig.strategy}
                                                        </div>
                                                        <div className="text-[10px] text-gray-400">Short: {sig.shortStrike} | credit: {sig.credit}</div>
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap font-mono text-sm text-gray-300">
                                                        ${sig.entryPrice.toFixed(2)}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        <span className={clsx(
                                                            "px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase",
                                                            sig.result === 'WIN' ? "bg-green-900/30 text-green-400 border border-green-500/20" :
                                                                sig.result === 'LOSS' ? "bg-red-900/30 text-red-400 border border-red-500/20" :
                                                                    "bg-gray-700 text-gray-400"
                                                        )}>
                                                            {sig.result}
                                                        </span>
                                                        <div className="text-[10px] text-gray-500 mt-1 italic">
                                                            {sig.exitTime ? `Exit: ${new Date(sig.exitTime).toLocaleTimeString()} @ ${sig.exitPrice.toFixed(2)}` : ''}
                                                        </div>
                                                    </td>
                                                    <td className={clsx(
                                                        "px-6 py-4 whitespace-nowrap text-right font-mono text-sm",
                                                        sig.pnl > 0 ? "text-green-400" : sig.pnl < 0 ? "text-red-400" : "text-gray-500"
                                                    )}>
                                                        {sig.pnl > 0 ? '+' : ''}{sig.pnl.toFixed(0)}
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}

                {/* Empty State when no results yet */}
                {!results && !isRunning && !error && (
                    <div className="text-center py-20 bg-gray-800/20 border-2 border-dashed border-gray-700/50 rounded-2xl">
                        <PlayCircle className="h-16 w-16 text-gray-700 mx-auto mb-4 opacity-50" />
                        <h3 className="text-xl font-semibold text-gray-400 mb-2">{t('Simulation Results will appear here')}</h3>
                        <p className="text-gray-500 max-w-sm mx-auto">{t('Select a symbol with historical snapshots and click "Start Full Backtest" to evaluate performance.')}</p>
                    </div>
                )}
            </main>
        </div>
    );
}
