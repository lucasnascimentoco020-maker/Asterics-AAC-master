import { interactionService } from './interactionService';

class ReportService {
    /**
     * Gera um relatório de uso a partir das interações registradas.
     * @returns {Promise<Object>} relatório com indicadores de uso
     */
    async generateUsageReport() {
        const interactions = await interactionService.getInteractions();
        const total = interactions.length;

        // Frequência por elemento (qual célula foi mais usada)
        const byElement = {};
        // Frequência por tipo de ação
        const byActionType = {};
        // Uso por dia (para ver evolução ao longo do tempo)
        const byDay = {};

        interactions.forEach(inter => {
            const elementKey = inter.label || inter.elementId;
            byElement[elementKey] = (byElement[elementKey] || 0) + 1;

            const actionKey = inter.actionType || 'unknown';
            byActionType[actionKey] = (byActionType[actionKey] || 0) + 1;

            const day = new Date(inter.timestamp).toLocaleDateString();
            byDay[day] = (byDay[day] || 0) + 1;
        });

        return {
            generatedAt: new Date().toISOString(),
            totalInteractions: total,
            mostUsedElements: this._sortDesc(byElement),
            interactionsByActionType: this._sortDesc(byActionType),
            interactionsByDay: this._sortAsc(byDay)
        };
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
