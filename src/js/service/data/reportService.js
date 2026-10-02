import { interactionService } from './interactionService';
import { localStorageService } from './localStorageService';

class ReportService {
    _getAiCacheKey(filters = {}) {
        const scope = filters.userId || interactionService.getCurrentUserId() || 'all';
        return `ASTERICS_PEDAGOGICAL_AI_WEEKLY_CACHE_${encodeURIComponent(scope)}`;
    }

    _getCachedAiAnalysis(filters = {}) {
        try {
            const cacheEntry = localStorageService.getJSON(this._getAiCacheKey(filters));
            if (cacheEntry && this._isValidAiFeedback(cacheEntry.lastAnalysis && cacheEntry.lastAnalysis.feedback)) {
                return cacheEntry.lastAnalysis;
            }
            if (cacheEntry && this._isValidAiFeedback(cacheEntry.feedback)) {
                return { feedback: cacheEntry.feedback, generatedAt: cacheEntry.generatedAt };
            }
        } catch (error) {
            return null;
        }
        return null;
    }

    /**
     * Gera um relatório de uso a partir das interações registradas.
     * @returns {Promise<Object>} relatório com indicadores de uso
     */
    async generateUsageReport(filters = {}) {
        if (!filters.userId) {
            return {
                generatedAt: null,
                totalInteractions: 0,
                totalSessions: 0,
                mostUsedElements: [],
                mostUsedItems: [],
                mostUsedCombinations: [],
                interactionsByActionType: [],
                interactionsByDay: [],
                userHistory: [],
                lastAiAnalysis: null
            };
        }
        const localReport = await this._generateLocalReport(filters);
        // Se habilitada, a API PostgreSQL fornece o relatório centralizado.
        const remoteReport = await this._getRemoteReport(filters);
        let report = localReport;
        if (remoteReport) {
            // Uma resposta remota vazia não deve esconder eventos já salvos localmente.
            if (remoteReport.totalInteractions > 0 || localReport.totalInteractions === 0) {
                report = Object.assign(remoteReport, {
                    pedagogicalFeedback: this._buildPedagogicalFeedback(remoteReport),
                    pedagogicalFeedbackSource: 'indicators'
                });
            }
        }
        report.lastAiAnalysis = this._getCachedAiAnalysis(filters);
        return report;
    }

    async generateAiAnalysis(report, filters = {}) {
        if (!filters.userId) {
            throw new Error('Selecione um aluno antes de solicitar a análise.');
        }
        if (typeof window === 'undefined' || !window.fetch) {
            throw new Error('A API de análise não está disponível neste navegador.');
        }

        const statusResponse = await window.fetch('/api/usage/pedagogical-analysis/status');
        if (!statusResponse.ok) {
            throw new Error('Não foi possível verificar a configuração da IA.');
        }
        const status = await statusResponse.json();
        if (!status.enabled) {
            throw new Error('A IA não está configurada no servidor.');
        }

        const response = await window.fetch('/api/usage/pedagogical-analysis', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(this._buildAiAnalysisData(report))
        });
        if (!response.ok) {
            const result = await response.json().catch(() => ({}));
            throw new Error(result.details || 'A IA não conseguiu gerar a análise. Verifique a chave, a cota e a conexão do servidor.');
        }

        const result = await response.json();
        if (!this._isValidAiFeedback(result.feedback)) {
            throw new Error('A resposta da IA veio em um formato inválido.');
        }

        const analysis = { feedback: result.feedback, generatedAt: new Date().toISOString() };
        const cacheKey = this._getAiCacheKey(filters);
        let cacheEntry = {};
        try {
            cacheEntry = localStorageService.getJSON(cacheKey) || {};
        } catch (error) {
            cacheEntry = {};
        }
        cacheEntry.lastAnalysis = analysis;
        cacheEntry.feedback = analysis.feedback;
        cacheEntry.generatedAt = analysis.generatedAt;
        try {
            localStorageService.saveJSON(cacheKey, cacheEntry);
        } catch (error) {
            // A resposta continua disponível nesta sessão se o armazenamento falhar.
        }
        return analysis;
    }

    async _generateLocalReport(filters) {
        // Caso contrário, consulta os eventos armazenados localmente no PouchDB.
        let interactions = await interactionService.getInteractions();
        log.info('[usage] relatório antes dos filtros', {
            count: interactions.length,
            userIds: [...new Set(interactions.map(interaction => interaction.userId).filter(Boolean))],
            database: interactionService.getCurrentUserId()
        });
        // Aplica os filtros pedagógicos antes de calcular os indicadores.
        interactions = interactions.filter(interaction => {
            const timestamp = new Date(interaction.timestamp).getTime();
            if (!Number.isFinite(timestamp)) {
                return false;
            }
            const matchesUser = !filters.userId || interaction.userId === filters.userId;
            const matchesFrom = !filters.from || timestamp >= new Date(filters.from).getTime();
            const matchesTo = !filters.to || timestamp < new Date(filters.to).getTime() + 86400000;
            return matchesUser && matchesFrom && matchesTo;
        });
        log.info('[usage] filtros do relatório aplicados', {
            filters,
            count: interactions.length,
            userIds: [...new Set(interactions.map(interaction => interaction.userId).filter(Boolean))]
        });
        // Total de ativações no período e usuário selecionados.
        const total = interactions.length;

        // Frequência por elemento (qual célula foi mais usada)
        const byElement = {};
        // Frequência por tipo de ação
        const byActionType = {};
        // Uso por dia (para ver evolução ao longo do tempo)
        const byDay = {};

        // Percorre os eventos uma única vez para gerar as três agregações.
        interactions.forEach(inter => {
            const elementKey = this._getItemLabel(inter);
            byElement[elementKey] = (byElement[elementKey] || 0) + 1;

            const actionKey = inter.actionType || 'unknown';
            byActionType[actionKey] = (byActionType[actionKey] || 0) + 1;

            const day = new Date(inter.timestamp).toLocaleDateString('pt-BR');
            byDay[day] = (byDay[day] || 0) + 1;
        });
        const mostUsedCombinations = this._getMostUsedCombinations(interactions);

        return {
            generatedAt: new Date().toISOString(),
            totalInteractions: total,
            // Set elimina IDs repetidos e conta cada sessão apenas uma vez.
            totalSessions: new Set(interactions.map(inter => inter.sessionId).filter(Boolean)).size,
            mostUsedElements: this._sortDesc(byElement),
            mostUsedItems: this._sortDesc(byElement),
            mostUsedCombinations,
            interactionsByActionType: this._sortDesc(byActionType),
            interactionsByDay: this._sortAsc(byDay),
            userHistory: interactions
                .slice()
                .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
                .slice(0, 500),
            pedagogicalFeedback: this._buildPedagogicalFeedback({
                totalInteractions: total,
                totalSessions: new Set(interactions.map(inter => inter.sessionId).filter(Boolean)).size,
                mostUsedElements: this._sortDesc(byElement),
                mostUsedCombinations,
                interactionsByActionType: this._sortDesc(byActionType),
                interactionsByDay: this._sortAsc(byDay)
            }, interactions),
            pedagogicalFeedbackSource: 'indicators'
        };
    }

    _getMostUsedCombinations(interactions) {
        const previousBySession = {};
        const combinations = {};
        interactions
            .filter(interaction => interaction.sessionId && Number.isFinite(new Date(interaction.timestamp).getTime()))
            .slice()
            .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
            .forEach(interaction => {
                const sessionKey = `${interaction.userId || ''}:${interaction.sessionId}`;
                const previous = previousBySession[sessionKey];
                if (previous) {
                    const items = [previous, this._getItemLabel(interaction)];
                    const key = JSON.stringify(items);
                    combinations[key] = combinations[key] || { items, count: 0 };
                    combinations[key].count += 1;
                }
                previousBySession[sessionKey] = this._getItemLabel(interaction);
            });
        return Object.values(combinations).sort((a, b) => b.count - a.count).slice(0, 20);
    }

    _buildAiAnalysisData(report) {
        // Envia apenas estatísticas agregadas, sem IDs de aluno ou histórico individual.
        return {
            totalInteractions: report.totalInteractions || 0,
            totalSessions: report.totalSessions || 0,
            mostUsedElements: report.mostUsedElements || [],
            mostUsedCombinations: report.mostUsedCombinations || [],
            interactionsByActionType: report.interactionsByActionType || [],
            interactionsByDay: report.interactionsByDay || [],
            imageDataNote: 'O registro atual contém rótulos e IDs dos elementos, mas não armazena os arquivos de imagem; não inferir conteúdo visual.'
        };
    }

    _isValidAiFeedback(feedback) {
        return Boolean(feedback && typeof feedback.summary === 'string' &&
            Array.isArray(feedback.observations) &&
            Array.isArray(feedback.interpretations) &&
            Array.isArray(feedback.recommendations));
    }

    _buildPedagogicalFeedback(report, interactions = []) {
        const total = report.totalInteractions || 0;
        const uniqueItems = (report.mostUsedElements || []).length;
        const activeDays = (report.interactionsByDay || []).length;
        const sessions = report.totalSessions || 0;
        const observations = [];
        const interpretations = [];
        const recommendations = [];
        const minimumDataMessage = total < 5
            ? 'Há poucos registros para uma leitura pedagógica consistente; os apontamentos abaixo são apenas iniciais.'
            : '';
        const periods = {};

        interactions.forEach(interaction => {
            const hour = new Date(interaction.timestamp).getHours();
            const period = hour < 6 ? 'madrugada' : hour < 12 ? 'manhã' : hour < 18 ? 'tarde' : 'noite';
            periods[period] = (periods[period] || 0) + 1;
        });

        if (!total) {
            return {
                summary: 'Ainda não há interações suficientes para elaborar uma devolutiva pedagógica.',
                observations: ['Não foram encontrados registros no período selecionado.'],
                interpretations: ['Não é possível inferir padrões de uso com os dados atuais.'],
                recommendations: ['Pode ser útil realizar mais interações e revisar o relatório novamente.']
            };
        }

        const interactionsPerSession = sessions ? total / sessions : total;
        const vocabularyRate = total ? uniqueItems / total : 0;
        const actionTypes = (report.interactionsByActionType || []).map(item => [String(item[0]).toUpperCase(), item[1]]);
        const functionalCount = actionTypes
            .filter(item => /NAVIGATE|AUDIO|YOUTUBE|WEBRADIO|PODCAST|HTTP|SYSTEM|UART|MATRIX|OPEN/.test(item[0]))
            .reduce((sum, item) => sum + item[1], 0);
        const pedagogicalCount = actionTypes
            .filter(item => /SPEAK|WORD|PREDICT|COLLECT|NORMAL/.test(item[0]))
            .reduce((sum, item) => sum + item[1], 0);

        observations.push(`Foram registradas ${total} interações em ${sessions || 'uma'} sessão(ões), distribuídas em ${activeDays} dia(s).`);
        if (report.mostUsedElements && report.mostUsedElements.length) {
            observations.push(`Os itens mais acionados foram ${report.mostUsedElements.slice(0, 3).map(item => item[0]).join(', ')}.`);
        }
        observations.push(`A variedade observada foi de ${uniqueItems} item(ns) distintos, aproximadamente ${Math.round(vocabularyRate * 100)}% do total de interações.`);
        if (functionalCount || pedagogicalCount) {
            const functionalShare = Math.round((functionalCount / total) * 100);
            const pedagogicalShare = Math.round((pedagogicalCount / total) * 100);
            observations.push(`Os registros classificados como funcionais representam cerca de ${functionalShare}% e os classificados como pedagógicos/comunicativos, cerca de ${pedagogicalShare}%.`);
        }
        if (activeDays > 1) {
            observations.push(`Há registros em ${activeDays} dias, o que permite observar alguma continuidade de uso.`);
        } else {
            observations.push('Os registros estão concentrados em um único dia, portanto ainda não mostram continuidade ao longo do tempo.');
        }
        const mostUsedPeriod = Object.entries(periods).sort((a, b) => b[1] - a[1])[0];
        if (mostUsedPeriod) {
            observations.push(`A maior concentração de registros ocorreu no período da ${mostUsedPeriod[0]} (${mostUsedPeriod[1]} interação(ões)); recomenda-se relacionar esse dado ao contexto das atividades.`);
        }

        if (vocabularyRate < 0.2) {
            interpretations.push('Os registros sugerem uso concentrado em poucos itens; recomenda-se observar se isso corresponde ao objetivo da atividade ou à preferência atual do aluno.');
            recommendations.push('Pode ser útil oferecer oportunidades graduais para explorar itens relacionados ao tema trabalhado, sem retirar os itens que já favorecem a participação.');
        } else if (vocabularyRate >= 0.5) {
            interpretations.push('Os registros sugerem exploração relativamente variada do vocabulário disponível no período analisado.');
            recommendations.push('Pode ser útil ampliar essa variedade com modelagem de novos itens em atividades significativas e contextualizadas.');
        } else {
            interpretations.push('Os registros sugerem uma combinação de itens recorrentes e alguma exploração de vocabulário.');
        }
        if (functionalCount > pedagogicalCount) {
            interpretations.push('O uso observado parece estar mais concentrado em ações funcionais; recomenda-se observar como integrar comunicação e objetivos pedagógicos nas mesmas situações.');
            recommendations.push('Pode ser útil planejar atividades em que pedidos, escolhas e navegação também apoiem conteúdos pedagógicos específicos.');
        } else if (pedagogicalCount > 0) {
            interpretations.push('Há registros compatíveis com uso comunicativo ou pedagógico; isso deve ser interpretado junto ao contexto das atividades e à observação da professora.');
            recommendations.push('Recomenda-se relacionar os itens mais usados às propostas de sala e registrar quais situações favoreceram maior participação.');
        } else {
            interpretations.push('Não foi possível classificar com segurança o equilíbrio entre uso funcional e pedagógico apenas pelos tipos de ação registrados.');
        }
        if (interactionsPerSession >= 10) {
            interpretations.push('A frequência por sessão sugere engajamento durante os períodos registrados, sem permitir concluir sobre motivação ou desempenho.');
            recommendations.push('Pode ser útil observar a duração, a iniciativa e a resposta do aluno durante essas sessões, além da contagem de cliques.');
        } else {
            interpretations.push('A frequência registrada por sessão é baixa ou moderada; recomenda-se observar se houve tempo suficiente, oportunidade de escolha e apoio adequado.');
            recommendations.push('Pode ser útil oferecer convites de participação em diferentes momentos do dia e verificar se o acesso ao vocabulário está confortável.');
        }
        if (activeDays < 2) {
            recommendations.push('Recomenda-se revisar a tendência após registros em mais dias e, se possível, comparar diferentes períodos ou atividades.');
        }

        if (minimumDataMessage) {
            interpretations.unshift(minimumDataMessage);
        }
        return {
            summary: minimumDataMessage || `Os registros sugerem ${total} interações em ${activeDays} dia(s), com uso de ${uniqueItems} item(ns) distintos. Esta síntese apoia a observação pedagógica e não substitui o acompanhamento da professora.`,
            observations,
            interpretations,
            recommendations
        };
    }

    getCurrentUserId() {
        return localStorageService.getAutologinOrActiveUser() || 'offline';
    }

    async _getRemoteReport(filters) {
        // O relatório remoto só é consultado quando explicitamente habilitado.
        if (!this._isUsageApiEnabled() || typeof window === 'undefined' || !window.fetch) {
            return null;
        }
        const params = new URLSearchParams();
        if (filters.userId) params.set('userId', filters.userId);
        if (filters.from) params.set('from', filters.from);
        if (filters.to) params.set('to', new Date(new Date(filters.to).getTime() + 86400000).toISOString());
        try {
            // Os filtros são enviados na query string da API.
            const response = await window.fetch('/api/usage/reports?' + params.toString());
            if (!response.ok) return null;
            const report = await response.json();
            return Object.assign(report, {
                mostUsedElements: (report.mostUsedItems || []).map(item => [item.item, item.count]),
                mostUsedCombinations: (report.mostUsedCombinations || []).map(item => ({
                    items: [item.first_item, item.second_item],
                    count: item.count
                })),
                interactionsByDay: (report.interactionsByDay || []).map(item => [String(item.day), item.count]),
                userHistory: (report.userHistory || []).map(interaction => ({
                    id: interaction.id,
                    userId: interaction.student_id,
                    timestamp: interaction.occurred_at,
                    label: interaction.item,
                    elementId: interaction.item,
                    actionType: interaction.interaction_type
                }))
            });
        } catch (error) {
            return null;
        }
    }

    _isUsageApiEnabled() {
        const queryEnabled = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('usageApi') === 'true';
        return queryEnabled || localStorageService.get('ASTERICS_USAGE_API_ENABLED') === 'true';
    }

    _getItemLabel(interaction) {
        // Usa o texto do evento; se não houver, mantém o ID técnico do elemento.
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
