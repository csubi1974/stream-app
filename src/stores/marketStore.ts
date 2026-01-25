import { create } from 'zustand';

export interface TradeData {
  symbol: string;
  price: number;
  size: number;
  side: 'BUY' | 'SELL';
  exchange: string;
  timestamp: string;
}

export interface OptionsBookData {
  symbol: string;
  bids: Array<{ price: number; size: number; exchange: string }>;
  asks: Array<{ price: number; size: number; exchange: string }>;
  last: { price: number; size: number; time: string };
}

export interface VolumeData {
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
  totalGEX: number;                    // Gamma Exposure Total Neta
  gammaFlip: number;                   // Precio donde GEX cambia de + a -
  netInstitutionalDelta: number;       // Delta neto institucional
  netDrift: number;                    // Dirección del empuje del mercado
  callWall: number;                    // Resistencia (strike con mayor Call GEX)
  putWall: number;                     // Soporte (strike con mayor Put GEX)
  currentPrice: number;                // Precio actual del subyacente
  regime: 'stable' | 'volatile' | 'neutral'; // Régimen de volatilidad
  expectedMove?: number;               // Movimiento esperado del día (ATM Straddle)
  vannaExposure?: number;              // Exposición Vanna Neta (IV Drop -> Buy/Sell)
}

interface MarketStore {
  // Options data
  optionsBooks: Record<string, OptionsBookData>;
  timeSales: Record<string, TradeData[]>;
  zeroDTEOptions: ZeroDTEOption[];

  // GEX Metrics
  gexMetrics: GEXMetrics | null;

  // Scanner data
  volumeData: VolumeData[];

  // Real-time data
  activeTrades: TradeData[];
  sweepAlerts: TradeData[];

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
}

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

  // Actions
  setOptionsBook: (symbol, data) => set((state) => ({
    optionsBooks: {
      ...state.optionsBooks,
      [symbol]: data
    }
  })),

  setTimeSales: (symbol, data) => set((state) => ({
    timeSales: {
      ...state.timeSales,
      [symbol]: data
    }
  })),

  addTrade: (trade) => set((state) => {
    const updatedTrades = [trade, ...state.activeTrades].slice(0, 100); // Keep last 100 trades

    // Update time & sales for the symbol
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

  addSweepAlert: (trade) => set((state) => ({
    sweepAlerts: [trade, ...state.sweepAlerts].slice(0, 20) // Keep last 20 alerts
  })),

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

  clearSweepAlerts: () => set({ sweepAlerts: [] })
}));