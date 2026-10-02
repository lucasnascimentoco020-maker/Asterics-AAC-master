const express = require('express');
const { Pool } = require('pg');

function createUsageApi() {
    // Cria um router isolado para ser montado pelo servidor principal.
    const router = express.Router();
    // Sem DATABASE_URL, a API permanece desativada e o app usa PouchDB local.
    const pool = process.env.DATABASE_URL
        ? new Pool({
            connectionString: process.env.DATABASE_URL,
            ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : undefined
        })
        : null;
    const aiRequestsByIp = new Map();

    function allowAiRequest(req, res, next) {
        const now = Date.now();
        const ip = req.ip || 'unknown';
        const recentRequests = (aiRequestsByIp.get(ip) || []).filter(timestamp => now - timestamp < 60000);
        if (recentRequests.length >= 5) {
            return res.status(429).json({ error: 'AI analysis rate limit exceeded' });
        }
        recentRequests.push(now);
        aiRequestsByIp.set(ip, recentRequests);
        next();
    }

    function authorized(req) {
        // O token é opcional no desenvolvimento e obrigatório quando configurado.
        const configuredToken = process.env.USAGE_API_TOKEN;
        return !configuredToken || req.get('authorization') === `Bearer ${configuredToken}`;
    }

    function requireDatabase(req, res, next) {
        if (!authorized(req)) {
            return res.status(401).json({ error: 'unauthorized' });
        }
        if (!pool) {
            return res.status(503).json({ error: 'DATABASE_URL is not configured' });
        }
        next();
    }

    router.post('/events', requireDatabase, async (req, res) => {
        // Recebe eventos já validados pelo modelo do frontend.
        const event = req.body || {};
        if (!event.id || !event.userId || !event.sessionId || !event.gridId || !event.elementId) {
            return res.status(400).json({ error: 'id, userId, sessionId, gridId and elementId are required' });
        }

        // Uma transação mantém aluno, sessão, grade e evento consistentes.
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            await client.query(
                `INSERT INTO students (id) VALUES ($1) ON CONFLICT (id) DO NOTHING`,
                [event.userId]
            );
            await client.query(
                `INSERT INTO boards (id, name) VALUES ($1, $2)
                 ON CONFLICT (id) DO UPDATE SET name = COALESCE(EXCLUDED.name, boards.name)`,
                [event.gridId, event.context || null]
            );
            const occurredAt = event.timestamp ? new Date(Number(event.timestamp)) : new Date();
            await client.query(
                `INSERT INTO usage_sessions (id, student_id, started_at, last_seen_at)
                 VALUES ($1, $2, $3, $3)
                 ON CONFLICT (id) DO UPDATE SET last_seen_at = GREATEST(usage_sessions.last_seen_at, EXCLUDED.last_seen_at)`,
                [event.sessionId, event.userId, occurredAt]
            );
            await client.query(
                `INSERT INTO interaction_events
                    (id, session_id, student_id, board_id, element_id, label, interaction_type,
                     occurred_at, session_duration_seconds, metadata)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                 ON CONFLICT (id) DO NOTHING`,
                [
                    event.id,
                    event.sessionId,
                    event.userId,
                    event.gridId,
                    event.elementId,
                    typeof event.label === 'string' ? event.label : JSON.stringify(event.label || null),
                    event.actionType || null,
                    occurredAt,
                    event.sessionDurationSeconds || null,
                    event.metadata || {}
                ]
            );
            await client.query('COMMIT');
            res.status(201).json({ stored: true, id: event.id });
        } catch (error) {
            await client.query('ROLLBACK');
            console.error('Unable to store usage event:', error);
            res.status(500).json({ error: 'unable to store usage event' });
        } finally {
            client.release();
        }
    });

    router.get('/reports', requireDatabase, async (req, res) => {
        // Monta filtros parametrizados para evitar interpolação de valores SQL.
        const values = [];
        const filters = [];
        if (req.query.userId) {
            values.push(req.query.userId);
            filters.push(`student_id = $${values.length}`);
        }
        if (req.query.from) {
            values.push(new Date(req.query.from));
            filters.push(`occurred_at >= $${values.length}`);
        }
        if (req.query.to) {
            values.push(new Date(req.query.to));
            filters.push(`occurred_at < $${values.length}`);
        }
        const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
        try {
            // Executa em paralelo os agregados necessários para a visão pedagógica.
            const [summary, topItems, sessions, daily, history, combinations] = await Promise.all([
                pool.query(`SELECT COUNT(*)::int AS total_interactions, COUNT(DISTINCT session_id)::int AS total_sessions FROM interaction_events ${where}`, values),
                pool.query(`SELECT COALESCE(label, element_id) AS item, COUNT(*)::int AS count FROM interaction_events ${where} GROUP BY item ORDER BY count DESC LIMIT 20`, values),
                pool.query(`SELECT session_id, student_id, MIN(occurred_at) AS started_at, MAX(occurred_at) AS last_seen_at, COUNT(*)::int AS interaction_count FROM interaction_events ${where} GROUP BY session_id, student_id ORDER BY started_at DESC`, values),
                pool.query(`SELECT DATE(occurred_at) AS day, COUNT(*)::int AS count FROM interaction_events ${where} GROUP BY day ORDER BY day`, values),
                pool.query(`SELECT id, student_id, session_id, occurred_at, COALESCE(label, element_id) AS item, interaction_type FROM interaction_events ${where} ORDER BY occurred_at DESC LIMIT 500`, values),
                pool.query(`WITH sequenced AS (
                    SELECT session_id, COALESCE(label, element_id) AS item,
                        LAG(COALESCE(label, element_id)) OVER (PARTITION BY session_id ORDER BY occurred_at) AS previous_item
                    FROM interaction_events ${where}
                )
                SELECT previous_item AS first_item, item AS second_item, COUNT(*)::int AS count
                FROM sequenced WHERE previous_item IS NOT NULL
                GROUP BY previous_item, item ORDER BY count DESC LIMIT 20`, values)
            ]);
            res.json({
                generatedAt: new Date().toISOString(),
                totalInteractions: summary.rows[0].total_interactions,
                totalSessions: summary.rows[0].total_sessions,
                mostUsedItems: topItems.rows,
                mostUsedCombinations: combinations.rows,
                sessions: sessions.rows,
                interactionsByDay: daily.rows,
                userHistory: history.rows
            });
        } catch (error) {
            console.error('Unable to generate usage report:', error);
            res.status(500).json({ error: 'unable to generate usage report' });
        }
    });

    router.get('/pedagogical-analysis/status', (req, res) => {
        res.json({ enabled: Boolean(process.env.PEDAGOGICAL_AI_API_KEY) });
    });

    router.post('/pedagogical-analysis', allowAiRequest, async (req, res) => {
        const apiKey = process.env.PEDAGOGICAL_AI_API_KEY;
        if (!apiKey) {
            return res.status(503).json({ error: 'Pedagogical AI is not configured' });
        }
        const analysisData = req.body || {};
        if (Buffer.byteLength(JSON.stringify(analysisData), 'utf8') > 95000 ||
            !Number.isFinite(Number(analysisData.totalInteractions))) {
            return res.status(400).json({ error: 'Invalid analysis data' });
        }

        const prompt = 'Analise todo o banco de dados, as imagens mais usadas e suas combinações, tente entender o que a criança está fazendo no aplicativo, após isso faça um relatorio de apoio pedagogico para que a professora posa usar, o relatorio deve conter todas as estatisticas das imagens usadas, observações e um relatorio de como a professora pode proceguir para melhorar o ensino do aluno baseado no que ela faz no aplicativo, podendo mudar o proprio aplicativo ou o que a criança faz fora dele.\n\n' +
            'Use somente as estatísticas agregadas fornecidas. Os dados não incluem os arquivos visuais das imagens, apenas rótulos e identificadores; não afirme ter visto imagens. Separe fatos observados de hipóteses, não infira diagnóstico, intenção, capacidade ou estado emocional, e proponha ações práticas que a professora possa adaptar dentro e fora do aplicativo. A resposta deve ser JSON com as propriedades summary (string), observations (array de strings), interpretations (array de strings) e recommendations (array de strings).';
        const provider = (process.env.PEDAGOGICAL_AI_PROVIDER || 'openai').toLowerCase();
        const model = process.env.PEDAGOGICAL_AI_MODEL || (provider === 'gemini' ? 'gemini-3.8-flash' : 'gpt-4o-mini');
        const defaultApiUrl = provider === 'gemini'
            ? `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`
            : 'https://api.openai.com/v1/chat/completions';
        const apiUrl = process.env.PEDAGOGICAL_AI_API_URL || defaultApiUrl;

        try {
            const requestOptions = provider === 'gemini'
                ? {
                    method: 'POST',
                    headers: { 'x-goog-api-key': apiKey, 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        systemInstruction: { parts: [{ text: prompt }] },
                        contents: [{ role: 'user', parts: [{ text: JSON.stringify(analysisData) }] }],
                        generationConfig: { temperature: 0.2, responseMimeType: 'application/json', maxOutputTokens: 1200 }
                    })
                }
                : {
                    method: 'POST',
                    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        model,
                        temperature: 0.2,
                        response_format: { type: 'json_object' },
                        messages: [
                            { role: 'system', content: prompt },
                            { role: 'user', content: JSON.stringify(analysisData) }
                        ]
                    })
                };
            const aiResponse = await fetch(apiUrl, requestOptions);
            if (!aiResponse.ok) {
                const providerError = await aiResponse.json().catch(() => ({}));
                const details = String(providerError.error && providerError.error.message || `HTTP ${aiResponse.status}`)
                    .replaceAll(apiKey, '[redacted]');
                console.error('Pedagogical AI provider returned status:', aiResponse.status, details);
                return res.status(502).json({ error: 'AI provider request failed', details });
            }
            const completion = await aiResponse.json();
            const responseText = provider === 'gemini'
                ? (completion.candidates && completion.candidates[0] && completion.candidates[0].content.parts || [])
                    .map(part => part.text || '').join('')
                : completion.choices && completion.choices[0] && completion.choices[0].message.content;
            const feedback = JSON.parse(responseText);
            if (typeof feedback.summary !== 'string' ||
                !Array.isArray(feedback.observations) ||
                !Array.isArray(feedback.interpretations) ||
                !Array.isArray(feedback.recommendations)) {
                return res.status(502).json({ error: 'AI provider returned an invalid report' });
            }
            return res.json({ feedback });
        } catch (error) {
            console.error('Unable to generate pedagogical AI report:', error.message);
            return res.status(502).json({ error: 'Unable to generate pedagogical AI report' });
        }
    });

    return router;
}

module.exports = { createUsageApi };
