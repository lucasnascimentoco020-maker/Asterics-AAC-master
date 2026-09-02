const express = require('express');
const { Pool } = require('pg');

function createUsageApi() {
    const router = express.Router();
    const pool = process.env.DATABASE_URL
        ? new Pool({
            connectionString: process.env.DATABASE_URL,
            ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : undefined
        })
        : null;

    function authorized(req) {
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
        const event = req.body || {};
        if (!event.id || !event.userId || !event.sessionId || !event.gridId || !event.elementId) {
            return res.status(400).json({ error: 'id, userId, sessionId, gridId and elementId are required' });
        }

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
            const [summary, topItems, sessions, daily, history] = await Promise.all([
                pool.query(`SELECT COUNT(*)::int AS total_interactions, COUNT(DISTINCT session_id)::int AS total_sessions FROM interaction_events ${where}`, values),
                pool.query(`SELECT COALESCE(label, element_id) AS item, COUNT(*)::int AS count FROM interaction_events ${where} GROUP BY item ORDER BY count DESC LIMIT 20`, values),
                pool.query(`SELECT session_id, student_id, MIN(occurred_at) AS started_at, MAX(occurred_at) AS last_seen_at, COUNT(*)::int AS interaction_count FROM interaction_events ${where} GROUP BY session_id, student_id ORDER BY started_at DESC`, values),
                pool.query(`SELECT DATE(occurred_at) AS day, COUNT(*)::int AS count FROM interaction_events ${where} GROUP BY day ORDER BY day`, values),
                pool.query(`SELECT student_id, occurred_at, COALESCE(label, element_id) AS item, interaction_type FROM interaction_events ${where} ORDER BY occurred_at DESC LIMIT 500`, values)
            ]);
            res.json({
                generatedAt: new Date().toISOString(),
                totalInteractions: summary.rows[0].total_interactions,
                totalSessions: summary.rows[0].total_sessions,
                mostUsedItems: topItems.rows,
                sessions: sessions.rows,
                interactionsByDay: daily.rows,
                userHistory: history.rows
            });
        } catch (error) {
            console.error('Unable to generate usage report:', error);
            res.status(500).json({ error: 'unable to generate usage report' });
        }
    });

    return router;
}

module.exports = { createUsageApi };
