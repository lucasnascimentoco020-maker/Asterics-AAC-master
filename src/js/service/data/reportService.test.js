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
    window.fetch = jest.fn()
        .mockResolvedValueOnce({ ok: true, json: async () => ({ enabled: true }) })
        .mockResolvedValueOnce({
            ok: true,
            json: async () => ({
                feedback: {
                    summary: 'Resumo semanal', observations: [], interpretations: [], recommendations: []
                }
            })
        });
    const report = { totalInteractions: 10, mostUsedElements: [], mostUsedCombinations: [], interactionsByActionType: [], interactionsByDay: [] };

    const result = await reportService.generateAiAnalysis(report, { userId: 'student-a' });

    expect(result.feedback.summary).toBe('Resumo semanal');
    expect(cache[reportService._getAiCacheKey({ userId: 'student-a' })].lastAnalysis).toEqual(result);
    expect(window.fetch).toHaveBeenCalledTimes(2);
});

test('manual AI analysis does not require remote usage reports to be enabled', async () => {
    localStorageService.get.mockReturnValue(null);
    window.fetch = jest.fn()
        .mockResolvedValueOnce({ ok: true, json: async () => ({ enabled: true }) })
        .mockResolvedValueOnce({
            ok: true,
            json: async () => ({
                feedback: {
                    summary: 'Análise manual', observations: [], interpretations: [], recommendations: []
                }
            })
        });

    const result = await reportService.generateAiAnalysis({ totalInteractions: 2 }, { userId: 'student-a' });

    expect(result.feedback.summary).toBe('Análise manual');
    expect(window.fetch).toHaveBeenCalledTimes(2);
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
    window.fetch = jest.fn()
        .mockResolvedValueOnce({ ok: true, json: async () => ({ enabled: true }) })
        .mockResolvedValueOnce({ ok: false, json: async () => ({ details: 'Falha simulada do provedor.' }) });

    await expect(reportService.generateAiAnalysis({ totalInteractions: 10 }, { userId: 'student-c' }))
        .rejects.toThrow('Falha simulada do provedor.');
    expect(reportService._getCachedAiAnalysis({ userId: 'student-c' })).toEqual(previousAnalysis);
    expect(window.fetch).toHaveBeenCalledTimes(2);
});

test('returns no previous analysis when the cache is empty', () => {
    localStorageService.getJSON.mockReturnValue(null);

    expect(reportService._getCachedAiAnalysis({ userId: 'student-d' })).toBeNull();
});
