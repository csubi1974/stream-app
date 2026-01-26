import { SchwabService } from './schwabService.js';

// Singleton instance
let schwabServiceInstance: SchwabService | null = null;

/**
 * Get the shared SchwabService instance
 */
export function getSchwabService(): SchwabService {
    if (!schwabServiceInstance) {
        console.log('🔧 Creating new SchwabService singleton instance');
        schwabServiceInstance = new SchwabService();
    }
    return schwabServiceInstance;
}

/**
 * Reset the singleton (useful for testing)
 */
export function resetSchwabService(): void {
    schwabServiceInstance = null;
}
