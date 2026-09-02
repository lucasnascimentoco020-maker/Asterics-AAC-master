import { Interaction } from '../../model/Interaction';
import { databaseService } from './databaseService';
import { localStorageService } from './localStorageService';

class InteractionService {
    /**
     * Registra uma interação do usuário no banco de dados.
     * @param {Object} interactionData - dados da interação (userId, gridId, elementId, label, actionType)
     */
    async logInteraction(interactionData) {
        // Constrói e valida o objeto antes de enviá-lo para a camada de dados.
        const interaction = new Interaction(interactionData);
        try {
            // O PouchDB é a fonte local de verdade e permite uso offline.
            await databaseService.saveObject(Interaction, interaction);
            // A cópia remota é opcional e não bloqueia o funcionamento local.
            this._sendToUsageApi(interaction);
            return interaction;
        } catch (err) {
            console.error('Erro ao registrar interação:', err);
            throw err;
        }
    }

    _sendToUsageApi(interaction) {
        // Evita chamadas ao backend quando o projeto está sendo usado localmente.
        if (!this.isUsageApiEnabled() || typeof window === 'undefined' || !window.fetch) {
            return;
        }
        // Envia o mesmo evento salvo localmente para a API de persistência remota.
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
        // Permite ativar a integração sem alterar o código, usando a URL de teste.
        const queryEnabled = new URLSearchParams(window.location.search).get('usageApi') === 'true';
        // A configuração persistida permite manter a escolha entre recarregamentos.
        return queryEnabled || localStorageService.get('ASTERICS_USAGE_API_ENABLED') === 'true';
    }

    /**
     * Busca todas as interações registradas.
     * @returns {Promise<Array>} lista de interações
     */
    async getInteractions() {
        try {
            // getObject retorna todos os documentos cujo ID começa com interaction.
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

