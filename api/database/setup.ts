import { mockDb } from './mock';

export async function setupDatabase(): Promise<void> {
  return mockDb.setup();
}