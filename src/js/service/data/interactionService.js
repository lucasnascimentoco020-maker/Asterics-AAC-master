import { Interaction } from '../../model/Interaction';
import { databaseService } from './databaseService';

class InteractionService {
    /**
     * Registra uma interação do usuário no banco de dados.
     * @param {Object} interactionData - dados da interação (userId, gridId, elementId, label, actionType)
     */
    async logInteraction(interactionData) {
        const interaction = new Interaction(interactionData);
        try {
            await databaseService.saveObject(interaction);
            this._sendToUsageApi(interaction);
            return interaction;
        } catch (err) {
            console.error('Erro ao registrar interação:', err);
            throw err;
        }
    }

    _sendToUsageApi(interaction) {
        if (typeof window === 'undefined' || !window.fetch) {
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

    /**
     * Busca todas as interações registradas.
     * @returns {Promise<Array>} lista de interações
     */
    async getInteractions() {
        try {
            const result = await databaseService.getObjectsByModelName(Interaction.getModelName());
            return result;
        } catch (err) {
            console.error('Erro ao buscar interações:', err);
            throw err;
        }
    }
}

export const interactionService = new InteractionService();

