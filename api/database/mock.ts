// Mock database service for development without SQLite
export class MockDatabase {
  private users: Map<string, any> = new Map();
  private alerts: Map<string, any> = new Map();
  private watchlist: Map<string, any> = new Map();
  private tradeHistory: any[] = [];

  async setup(): Promise<void> {
    console.log('✅ Mock database initialized');
  }

  async createUser(id: string, email: string, passwordHash: string, plan: string = 'free'): Promise<void> {
    this.users.set(id, { id, email, password_hash: passwordHash, plan, created_at: new Date().toISOString() });
  }

  async getUserByEmail(email: string): Promise<any | null> {
    for (const user of this.users.values()) {
      if (user.email === email) return user;
    }
    return null;
  }

  async createAlert(id: string, userId: string, symbol: string, type: string, parameters?: string): Promise<void> {
    this.alerts.set(id, { id, user_id: userId, symbol, type, parameters, active: true, created_at: new Date().toISOString() });
  }

  async getUserAlerts(userId: string): Promise<any[]> {
    const userAlerts: any[] = [];
    for (const alert of this.alerts.values()) {
      if (alert.user_id === userId) userAlerts.push(alert);
    }
    return userAlerts;
  }

  async addToWatchlist(id: string, userId: string, symbol: string, type: string): Promise<void> {
    this.watchlist.set(`${userId}-${symbol}`, { id, user_id: userId, symbol, type, added_at: new Date().toISOString() });
  }

  async getUserWatchlist(userId: string): Promise<any[]> {
    const userWatchlist: any[] = [];
    for (const item of this.watchlist.values()) {
      if (item.user_id === userId) userWatchlist.push(item);
    }
    return userWatchlist;
  }

  async removeFromWatchlist(userId: string, symbol: string): Promise<void> {
    this.watchlist.delete(`${userId}-${symbol}`);
  }

  async recordTrade(symbol: string, price: number, size: number, side: string, exchange?: string): Promise<void> {
    this.tradeHistory.push({
      id: `${symbol}-${Date.now()}-${Math.random()}`,
      symbol,
      price,
      size,
      side,
      exchange,
      timestamp: new Date().toISOString()
    });
  }

  async getTradeHistory(symbol: string, limit: number = 100): Promise<any[]> {
    return this.tradeHistory
      .filter(trade => trade.symbol === symbol)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit);
  }
}

export const mockDb = new MockDatabase();