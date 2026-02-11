import { create } from 'zustand';

export interface TradeData {
  symbol: string;
  price: number;
  size: number;
  side: 'BUY' | 'SELL';
  exchange: string;
  timestamp: string;
  count?: number;      // For stacked alerts
  totalSize?: number;  // For stacked alerts
}

export interface AppSettings {
  sweepThreshold: number;
  volumeAlertThreshold: number;
  enableSoundAlerts: boolean;
  enableVisualAlerts: boolean;
  alertPosition: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
  updateSpeed: number;
  darkMode: boolean;
  showGreeks: boolean;
  showVolumeProfile: boolean;
  schwabAppKey: string;
  schwabSecret: string;
  minRVOL: number;
  minDollarVolume: number;
  maxStocks: number;
}

export interface OptionsBookData {
  // ... (keep existing)
  symbol: string;
  bids: Array<{ price: number; size: number; exchange: string }>;
  asks: Array<{ price: number; size: number; exchange: string }>;
  last: { price: number; size: number; time: string };
}

export interface VolumeData {
  // ... (keep existing)
  symbol: string;
  name: string;
  rvol: number;
  price: number;
  volume: number;
  dollarVolume: number;
  changePercent: number;
  action: string;
  cvd: number;
  buyPressure: number;
  vwap: number;
  distanceFromVWAP: number;
  bidHits?: number;
  askHits?: number;
}

export interface ZeroDTEOption {
  // ... (keep existing)
  symbol: string;
  underlying: string;
  expiry: string;
  strike: number;
  type: 'CALL' | 'PUT';
  last: number;
  bid: number;
  ask: number;
  volume: number;
  openInterest: number;
  gamma: number;
  delta: number;
}

export interface GEXMetrics {
  // ... (keep existing)
  totalGEX: number;
  gammaFlip: number;
  netInstitutionalDelta: number;
  netDrift: number;
  callWall: number;
  putWall: number;
  currentPrice: number;
  regime: 'stable' | 'volatile' | 'neutral';
  expectedMove?: number;
  netVanna: number;
  netCharm: number;
  callWallStrength?: 'solid' | 'weak' | 'uncertain';
  putWallStrength?: 'solid' | 'weak' | 'uncertain';
  callWallLiquidity?: number;
  putWallLiquidity?: number;
  pinningTarget?: number;
  pinningConfidence?: number;
  pinningRationale?: string;
  maxPain?: number;
  ivRank?: number;
  termStructure?: Array<{ dte: number, iv: number }>;
  gammaProfile?: Array<{ price: number, netGex: number }>;
}

interface MarketStore {
  // Data
  optionsBooks: Record<string, OptionsBookData>;
  timeSales: Record<string, TradeData[]>;
  zeroDTEOptions: ZeroDTEOption[];
  gexMetrics: GEXMetrics | null;
  volumeData: VolumeData[];
  activeTrades: TradeData[];
  sweepAlerts: TradeData[];

  // App Configuration
  settings: AppSettings;

  // UI state
  selectedSymbol: string | null;
  subscribedSymbols: string[];

  // Actions
  setOptionsBook: (symbol: string, data: OptionsBookData) => void;
  setTimeSales: (symbol: string, data: TradeData[]) => void;
  addTrade: (trade: TradeData) => void;
  addSweepAlert: (trade: TradeData) => void;
  setVolumeData: (data: VolumeData[]) => void;
  setZeroDTEOptions: (data: ZeroDTEOption[]) => void;
  setGEXMetrics: (data: GEXMetrics) => void;
  setSelectedSymbol: (symbol: string | null) => void;
  addSubscribedSymbol: (symbol: string) => void;
  removeSubscribedSymbol: (symbol: string) => void;
  clearSweepAlerts: () => void;
  removeSweepAlert: (timestamp: string, symbol: string) => void;
  updateSettings: (settings: Partial<AppSettings>) => void;
}

const DEFAULT_SETTINGS: AppSettings = {
  sweepThreshold: 50,
  volumeAlertThreshold: 3.0,
  enableSoundAlerts: true,
  enableVisualAlerts: true,
  alertPosition: 'top-right',
  updateSpeed: 100,
  darkMode: true,
  showGreeks: true,
  showVolumeProfile: true,
  schwabAppKey: '',
  schwabSecret: '',
  minRVOL: 2.0,
  minDollarVolume: 50000000,
  maxStocks: 50
};

export const useMarketStore = create<MarketStore>((set, get) => ({
  // Initial state
  optionsBooks: {},
  timeSales: {},
  zeroDTEOptions: [],
  gexMetrics: null,
  volumeData: [],
  activeTrades: [],
  sweepAlerts: [],
  selectedSymbol: null,
  subscribedSymbols: [],
  settings: (() => {
    try {
      const saved = localStorage.getItem('tapeReaderSettings');
      return saved ? { ...DEFAULT_SETTINGS, ...JSON.parse(saved) } : DEFAULT_SETTINGS;
    } catch {
      return DEFAULT_SETTINGS;
    }
  })(),

  // Actions
  setOptionsBook: (symbol, data) => set((state) => ({
    optionsBooks: { ...state.optionsBooks, [symbol]: data }
  })),

  setTimeSales: (symbol, data) => set((state) => ({
    timeSales: { ...state.timeSales, [symbol]: data }
  })),

  addTrade: (trade) => set((state) => {
    const updatedTrades = [trade, ...state.activeTrades].slice(0, 100);
    const symbolTrades = state.timeSales[trade.symbol] || [];
    const updatedSymbolTrades = [trade, ...symbolTrades].slice(0, 50);

    return {
      activeTrades: updatedTrades,
      timeSales: {
        ...state.timeSales,
        [trade.symbol]: updatedSymbolTrades
      }
    };
  }),

  addSweepAlert: (trade) => set((state) => {
    const now = Date.now();
    const STACK_WINDOW_MS = 10000; // 10 seconds to stack similar alerts

    // Find if there's a recent alert for the same symbol
    const existingAlertIndex = state.sweepAlerts.findIndex(a =>
      a.symbol === trade.symbol &&
      (new Date().getTime() - new Date(a.timestamp).getTime()) < STACK_WINDOW_MS
    );

    if (existingAlertIndex !== -1) {
      // Update existing alert (Stacking)
      const updatedAlerts = [...state.sweepAlerts];
      const existing = updatedAlerts[existingAlertIndex];

      updatedAlerts[existingAlertIndex] = {
        ...existing,
        count: (existing.count || 1) + 1,
        totalSize: (existing.totalSize || existing.size) + trade.size,
        price: trade.price, // Update to latest price
        timestamp: new Date().toISOString() // Refresh timestamp
      };

      return { sweepAlerts: updatedAlerts };
    }

    // New alert
    const newAlert: TradeData = {
      ...trade,
      count: 1,
      totalSize: trade.size,
      timestamp: new Date().toISOString()
    };

    return {
      sweepAlerts: [newAlert, ...state.sweepAlerts].slice(0, 20)
    };
  }),

  setVolumeData: (data) => set({ volumeData: data }),
  setZeroDTEOptions: (data) => set({ zeroDTEOptions: data }),
  setGEXMetrics: (data) => set({ gexMetrics: data }),
  setSelectedSymbol: (symbol) => set({ selectedSymbol: symbol }),

  addSubscribedSymbol: (symbol) => set((state) => ({
    subscribedSymbols: [...new Set([...state.subscribedSymbols, symbol])]
  })),

  removeSubscribedSymbol: (symbol) => set((state) => ({
    subscribedSymbols: state.subscribedSymbols.filter(s => s !== symbol)
  })),

  clearSweepAlerts: () => set({ sweepAlerts: [] }),
  removeSweepAlert: (timestamp, symbol) => set((state) => ({
    sweepAlerts: state.sweepAlerts.filter(a => a.timestamp !== timestamp || a.symbol !== symbol)
  })),

  updateSettings: (newSettings) => set((state) => {
    const updatedSettings = { ...state.settings, ...newSettings };
    localStorage.setItem('tapeReaderSettings', JSON.stringify(updatedSettings));
    return { settings: updatedSettings };
  })
}));
