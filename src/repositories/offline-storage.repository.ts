// Repositório para gerenciar o armazenamento offline
export const offlineStorage = {
    getItem: (key: string) => {
        const data = localStorage.getItem(key);
        return data ? JSON.parse(data) : null;
    },
    setItem: (key: string, value: any) => {
        localStorage.setItem(key, JSON.stringify(value));
    },
    removeItem: (key: string) => {
        localStorage.removeItem(key);
    },
    getPendingOperations: async () => {
        return []; // Simulação de operações pendentes
    },
    cleanupSyncedOperations: async () => {
        // Simulação de limpeza
    },
    markOperationAsSynced: async (id: string) => {
        // Simulação de marcação
    },
    saveOfflineData: async (table: string, data: any) => {
        // Simulação de salvamento offline
    },
    getOfflineStats: async (): Promise<{ synced: number; pending: number; lastSync: string }> => {
        return { synced: 0, pending: 0, lastSync: new Date().toISOString() }; // Simulação de estatísticas com lastSync
    },
};