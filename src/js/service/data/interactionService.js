import { Interaction } from '../../model/Interaction';
import { databaseService } from './databaseService';
import { localStorageService } from './localStorageService';

class InteractionService {
    /**
     * Registra uma interação do usuário no banco de dados.
     * @param {Object} interactionData - dados da interação (userId, gridId, elementId, label, actionType)
     */
    async logInteraction(interactionData) {
        const interaction = new Interaction(interactionData);
        try {
            await databaseService.saveObject(Interaction, interaction);
            this._sendToUsageApi(interaction);
            return interaction;
        } catch (err) {
            console.error('Erro ao registrar interação:', err);
            throw err;
        }
    }

    _sendToUsageApi(interaction) {
        if (!this.isUsageApiEnabled() || typeof window === 'undefined' || !window.fetch) {
            return;
        }
        window.fetch('/api/usage/events', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(interaction)
        }).catch(() => {
            // PouchDB remains the local/offline source of truth.
        });
    }

    isUsageApiEnabled() {
        if (typeof window === 'undefined') {
            return false;
        }
        const queryEnabled = new URLSearchParams(window.location.search).get('usageApi') === 'true';
        return queryEnabled || localStorageService.get('ASTERICS_USAGE_API_ENABLED') === 'true';
    }

    /**
     * Busca todas as interações registradas.
     * @returns {Promise<Array>} lista de interações
     */
    async getInteractions() {
        try {
            const result = await databaseService.getObject(Interaction);
            return Array.isArray(result) ? result : result ? [result] : [];
        } catch (err) {
            console.error('Erro ao buscar interações:', err);
            throw err;
        }
    }

    getCurrentUserId() {
        return localStorageService.getAutologinOrActiveUser() || 'offline';
    }
}

export const interactionService = new InteractionService();

