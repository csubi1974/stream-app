
import { useState, useEffect } from 'react';
import { Header } from '../components/layout/Header';
import { Database, PlayCircle, Calendar, Download } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export function Backtest() {
    const { t } = useTranslation();
    const [dbStats, setDbStats] = useState<any>(null);

    useEffect(() => {
        // Fetch DB stats (Placeholder - logic to be added)
        // For now we simulate stats based on what we know
        setDbStats({
            totalSnapshots: 0,
            activeSymbols: ['SPX'],
            dbSize: '12 KB',
            lastSnapshot: t('Waiting for market data...')
        });
    }, [t]);

    return (
        <div className="min-h-screen bg-gray-900">
            <Header />

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-white mb-2">{t('Backtest Engine')}</h1>
                    <p className="text-gray-400">{t('Manage historical data')}</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    {/* Recorder Status */}
                    <div className="bg-gray-800 rounded-lg p-6 border border-green-500/30">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold text-white flex items-center">
                                <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse mr-2"></div>
                                {t('Data Recorder')}
                            </h3>
                            <span className="text-xs text-green-400 bg-green-900/30 px-2 py-1 rounded">{t('ACTIVE')}</span>
                        </div>
                        <div className="space-y-3">
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-400">{t('Target')}:</span>
                                <span className="text-white font-mono">{t('SPX Option Chain')}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-400">{t('Interval')}:</span>
                                <span className="text-white font-mono">{t('5 min')}</span>
                            </div>
                            <div className="mt-4 pt-4 border-t border-gray-700">
                                <div className="text-xs text-gray-500 mb-1">{t('Current Session')}</div>
                                <div className="text-xl font-bold text-white">{t('Recording...')}</div>
                            </div>
                        </div>
                    </div>

                    {/* Database Stats */}
                    <div className="bg-gray-800 rounded-lg p-6">
                        <div className="flex items-center mb-4">
                            <Database className="h-5 w-5 text-blue-500 mr-2" />
                            <h3 className="text-lg font-semibold text-white">{t('Historical Data')}</h3>
                        </div>
                        <div className="space-y-4">
                            <div className="bg-gray-700/50 rounded p-3">
                                <div className="text-gray-400 text-xs mb-1">{t('Total Snapshots')}</div>
                                <div className="text-2xl font-bold text-white">{dbStats?.totalSnapshots || 0}</div>
                            </div>
                            <div className="flex justify-between text-sm text-gray-400">
                                <span>{t('DB Size')}: {dbStats?.dbSize}</span>
                                <span>{t('Symbol')}: {dbStats?.activeSymbols.join(', ')}</span>
                            </div>
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="bg-gray-800 rounded-lg p-6">
                        <div className="flex items-center mb-4">
                            <PlayCircle className="h-5 w-5 text-purple-500 mr-2" />
                            <h3 className="text-lg font-semibold text-white">{t('Simulations')}</h3>
                        </div>
                        <p className="text-sm text-gray-400 mb-6">
                            {t('Replay historical market conditions')}
                        </p>
                        <button className="w-full bg-purple-600 hover:bg-purple-700 text-white py-2 rounded font-medium transition-colors flex items-center justify-center disabled:opacity-50" disabled>
                            <PlayCircle className="h-4 w-4 mr-2" />
                            {t('Start Replay (Not enough data)')}
                        </button>
                        <div className="mt-4 text-center">
                            <button className="text-blue-400 text-sm hover:text-blue-300 flex items-center justify-center w-full">
                                <Download className="h-4 w-4 mr-1" />
                                {t('Export Data')}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Recent Snapshots Preview */}
                <div className="bg-gray-800 rounded-lg p-6">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold text-white">{t('Recent Snapshots')}</h3>
                        <Calendar className="h-5 w-5 text-gray-500" />
                    </div>

                    <div className="text-center py-12 border-2 border-dashed border-gray-700 rounded-lg">
                        <Database className="h-12 w-12 text-gray-600 mx-auto mb-4" />
                        <p className="text-gray-400">{t('Waiting for first recording cycle')}</p>
                        <p className="text-sm text-gray-500 mt-2">{t('Data recorded every 5 min')}</p>
                    </div>
                </div>
            </main>
        </div>
    );
}
