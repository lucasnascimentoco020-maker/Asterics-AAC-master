import { interactionService } from './interactionService';

class ReportService {
    /**
     * Gera um relatório de uso a partir das interações registradas.
     * @returns {Promise<Object>} relatório com indicadores de uso
     */
    async generateUsageReport(filters = {}) {
        const remoteReport = await this._getRemoteReport(filters);
        if (remoteReport) {
            return remoteReport;
        }
        let interactions = await interactionService.getInteractions();
        interactions = interactions.filter(interaction => {
            const timestamp = new Date(interaction.timestamp).getTime();
            const matchesUser = !filters.userId || interaction.userId === filters.userId;
            const matchesFrom = !filters.from || timestamp >= new Date(filters.from).getTime();
            const matchesTo = !filters.to || timestamp < new Date(filters.to).getTime() + 86400000;
            return matchesUser && matchesFrom && matchesTo;
        });
        const total = interactions.length;

        // Frequência por elemento (qual célula foi mais usada)
        const byElement = {};
        // Frequência por tipo de ação
        const byActionType = {};
        // Uso por dia (para ver evolução ao longo do tempo)
        const byDay = {};

        interactions.forEach(inter => {
            const elementKey = this._getItemLabel(inter);
            byElement[elementKey] = (byElement[elementKey] || 0) + 1;

            const actionKey = inter.actionType || 'unknown';
            byActionType[actionKey] = (byActionType[actionKey] || 0) + 1;

            const day = new Date(inter.timestamp).toLocaleDateString();
            byDay[day] = (byDay[day] || 0) + 1;
        });

        return {
            generatedAt: new Date().toISOString(),
            totalInteractions: total,
            totalSessions: new Set(interactions.map(inter => inter.sessionId).filter(Boolean)).size,
            mostUsedElements: this._sortDesc(byElement),
            mostUsedItems: this._sortDesc(byElement),
            interactionsByActionType: this._sortDesc(byActionType),
            interactionsByDay: this._sortAsc(byDay),
            userHistory: interactions.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).slice(0, 500)
        };
    }

    async _getRemoteReport(filters) {
        if (typeof window === 'undefined' || !window.fetch) {
            return null;
        }
        const params = new URLSearchParams();
        if (filters.userId) params.set('userId', filters.userId);
        if (filters.from) params.set('from', filters.from);
        if (filters.to) params.set('to', new Date(new Date(filters.to).getTime() + 86400000).toISOString());
        try {
            const response = await window.fetch('/api/usage/reports?' + params.toString());
            if (!response.ok) return null;
            const report = await response.json();
            return Object.assign(report, {
                mostUsedElements: (report.mostUsedItems || []).map(item => [item.item, item.count]),
                interactionsByDay: (report.interactionsByDay || []).map(item => [String(item.day), item.count])
            });
        } catch (error) {
            return null;
        }
    }

    _getItemLabel(interaction) {
        if (typeof interaction.label === 'string') {
            return interaction.label;
        }
        if (interaction.label && typeof interaction.label === 'object') {
            return Object.values(interaction.label).find(Boolean) || interaction.elementId;
        }
        return interaction.elementId;
    }

    /**
     * Ordena um objeto de contagens do maior para o menor.
     */
    _sortDesc(obj) {
        return Object.entries(obj).sort((a, b) => b[1] - a[1]);
    }

    /**
     * Ordena um objeto de contagens por chave (ex.: data).
     */
    _sortAsc(obj) {
        return Object.entries(obj).sort((a, b) => (a[0] < b[0] ? -1 : 1));
    }
}

export const reportService = new ReportService();
