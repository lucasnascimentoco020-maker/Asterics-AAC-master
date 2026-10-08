jest.mock('./interactionService', () => ({
    interactionService: {
        getInteractions: jest.fn(),
        getCurrentUserId: jest.fn(() => 'offline')
    }
}));
jest.mock('./localStorageService', () => ({
    localStorageService: {
        get: jest.fn(),
        getJSON: jest.fn(),
        saveJSON: jest.fn()
    }
}));

import { reportService } from './reportService';
import { interactionService } from './interactionService';
import { localStorageService } from './localStorageService';

test('counts consecutive item combinations within each session', () => {
    const interactions = [
        { userId: 'student-a', sessionId: 'session-1', timestamp: 1000, label: 'quero' },
        { userId: 'student-a', sessionId: 'session-1', timestamp: 2000, label: 'água' },
        { userId: 'student-b', sessionId: 'session-2', timestamp: 1500, label: 'quero' },
        { userId: 'student-b', sessionId: 'session-2', timestamp: 2500, label: 'água' },
        { userId: 'student-a', sessionId: 'session-1', timestamp: 3000, label: 'mais' }
    ];

    expect(reportService._getMostUsedCombinations(interactions)).toEqual([
        { items: ['quero', 'água'], count: 2 },
        { items: ['água', 'mais'], count: 1 }
    ]);
});

test('does not combine interactions from separate sessions', () => {
    const interactions = [
        { sessionId: 'session-1', timestamp: 1000, label: 'quero' },
        { sessionId: 'session-2', timestamp: 2000, label: 'água' }
    ];

    expect(reportService._getMostUsedCombinations(interactions)).toEqual([]);
});

test('does not load report records until an user is selected', async () => {
    const report = await reportService.generateUsageReport();

    expect(report.totalInteractions).toBe(0);
    expect(report.lastAiAnalysis).toBeNull();
    expect(interactionService.getInteractions).not.toHaveBeenCalled();
});

test('generates an AI analysis only when explicitly requested', async () => {
    const cache = {};
    localStorageService.get.mockReturnValue('true');
    localStorageService.getJSON.mockImplementation(key => cache[key] || null);
    localStorageService.saveJSON.mockImplementation((key, value) => { cache[key] = value; });
    cache.ASTERICS_PEDAGOGICAL_AI_SETTINGS = { provider: 'openai', apiKey: 'test-openai-key' };
    window.fetch = jest.fn()
        .mockResolvedValueOnce({
            ok: true,
            json: async () => ({
                choices: [{ message: { content: JSON.stringify({
                    summary: 'Resumo semanal', observations: [], interpretations: [], recommendations: []
                }) } }]
            })
        });
    const report = { totalInteractions: 10, mostUsedElements: [], mostUsedCombinations: [], interactionsByActionType: [], interactionsByDay: [] };

    const result = await reportService.generateAiAnalysis(report, { userId: 'student-a' });

    expect(result.feedback.summary).toBe('Resumo semanal');
    expect(cache[reportService._getAiCacheKey({ userId: 'student-a' })].lastAnalysis).toEqual(result);
    expect(window.fetch).toHaveBeenCalledTimes(1);
    expect(window.fetch.mock.calls[0][0]).toBe('https://api.openai.com/v1/chat/completions');
    expect(window.fetch.mock.calls[0][1].headers.Authorization).toBe('Bearer test-openai-key');
});

test('manual AI analysis does not require remote usage reports to be enabled', async () => {
    localStorageService.getJSON.mockImplementation(key => key === 'ASTERICS_PEDAGOGICAL_AI_SETTINGS'
        ? { provider: 'openai', apiKey: 'test-openai-key' }
        : null);
    localStorageService.get.mockReturnValue(null);
    window.fetch = jest.fn()
        .mockResolvedValueOnce({
            ok: true,
            json: async () => ({
                choices: [{ message: { content: JSON.stringify({
                    summary: 'Análise manual', observations: [], interpretations: [], recommendations: []
                }) } }]
            })
        });

    const result = await reportService.generateAiAnalysis({ totalInteractions: 2 }, { userId: 'student-a' });

    expect(result.feedback.summary).toBe('Análise manual');
    expect(window.fetch).toHaveBeenCalledTimes(1);
});

test('does not call AI automatically while loading a selected user report', async () => {
    interactionService.getInteractions.mockResolvedValue([]);
    localStorageService.get.mockReturnValue(null);
    localStorageService.getJSON.mockReturnValue(null);
    global.log = { info: jest.fn() };
    window.fetch = jest.fn();

    await reportService.generateUsageReport({ userId: 'student-a' });

    expect(window.fetch).not.toHaveBeenCalled();
});

test('preserves the last successful analysis when an explicit request fails', async () => {
    const previousAnalysis = {
        feedback: { summary: 'Análise anterior', observations: [], interpretations: [], recommendations: [] },
        generatedAt: '2026-09-20T12:00:00.000Z'
    };
    const cache = {};
    localStorageService.get.mockReturnValue('true');
    localStorageService.getJSON.mockImplementation(key => cache[key] || null);
    localStorageService.saveJSON.mockImplementation((key, value) => { cache[key] = value; });
    const cacheKey = reportService._getAiCacheKey({ userId: 'student-c' });
    cache[cacheKey] = { lastAnalysis: previousAnalysis };
    cache.ASTERICS_PEDAGOGICAL_AI_SETTINGS = { provider: 'openai', apiKey: 'test-openai-key' };
    window.fetch = jest.fn()
        .mockResolvedValueOnce({ ok: false, json: async () => ({ error: { message: 'Falha simulada do provedor.' } }) });

    await expect(reportService.generateAiAnalysis({ totalInteractions: 10 }, { userId: 'student-c' }))
        .rejects.toThrow('Falha simulada do provedor.');
    expect(reportService._getCachedAiAnalysis({ userId: 'student-c' })).toEqual(previousAnalysis);
    expect(window.fetch).toHaveBeenCalledTimes(1);
});

test('sends Gemini requests with the saved API key and extracts structured feedback', async () => {
    localStorageService.getJSON.mockImplementation(key => key === 'ASTERICS_PEDAGOGICAL_AI_SETTINGS'
        ? { provider: 'gemini', apiKey: 'test-gemini-key' }
        : null);
    window.fetch = jest.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({
            output: [{
                type: 'model_output',
                content: [{
                    type: 'text',
                    text: JSON.stringify({
                        summary: 'Síntese Gemini', observations: [], interpretations: [], recommendations: []
                    })
                }]
            }]
        })
    });

    const result = await reportService.generateAiAnalysis({ totalInteractions: 1 }, { userId: 'student-a' });
    const [url, request] = window.fetch.mock.calls[0];

    expect(result.feedback.summary).toBe('Síntese Gemini');
    expect(url).toBe('https://generativelanguage.googleapis.com/v1beta/interactions');
    expect(request.headers['x-goog-api-key']).toBe('test-gemini-key');
    const body = JSON.parse(request.body);
    expect(body.model).toBe('gemini-3.8-flash');
    expect(body.store).toBe(false);
    expect(body.response_format.mime_type).toBe('application/json');
});

test('parses Gemini feedback wrapped in markdown fences', () => {
    const feedback = {
        summary: 'Síntese com formato adicional',
        observations: ['Observação'],
        interpretations: [],
        recommendations: []
    };

    expect(reportService._parseAiFeedback(`Resultado:\n\`\`\`json\n${JSON.stringify(feedback)}\n\`\`\``))
        .toEqual(feedback);
});

test('parses Gemini interaction output_text responses', () => {
    const feedback = {
        summary: 'Texto da interação',
        observations: [],
        interpretations: [],
        recommendations: []
    };

    expect(reportService._extractGeminiOutputText({ output_text: JSON.stringify(feedback) }))
        .toBe(JSON.stringify(feedback));
});

test('returns no previous analysis when the cache is empty', () => {
    localStorageService.getJSON.mockReturnValue(null);

    expect(reportService._getCachedAiAnalysis({ userId: 'student-d' })).toBeNull();
});

test('saves the selected AI provider and normalized API key', () => {
    const storedSettings = {};
    localStorageService.saveJSON.mockImplementation((key, value) => { storedSettings[key] = value; });
    localStorageService.getJSON.mockImplementation(key => storedSettings[key] || null);

    expect(reportService.saveAiSettings({ provider: 'gemini', apiKey: '  test-key  ' }))
        .toEqual({ provider: 'gemini', apiKey: 'test-key' });
    expect(storedSettings.ASTERICS_PEDAGOGICAL_AI_SETTINGS)
        .toEqual({ provider: 'gemini', apiKey: 'test-key' });
});
