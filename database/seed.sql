INSERT INTO students (id) VALUES ('student-demo') ON CONFLICT (id) DO NOTHING;
INSERT INTO boards (id, name) VALUES ('board-demo', 'Prancha demonstrativa') ON CONFLICT (id) DO NOTHING;
INSERT INTO usage_sessions (id, student_id, started_at, last_seen_at)
VALUES ('session-demo', 'student-demo', NOW() - INTERVAL '15 minutes', NOW())
ON CONFLICT (id) DO NOTHING;
INSERT INTO interaction_events
    (id, session_id, student_id, board_id, element_id, label, interaction_type, occurred_at, metadata)
VALUES
    ('event-demo-1', 'session-demo', 'student-demo', 'board-demo', 'element-hello', 'Olá', 'ELEMENT_TYPE_NORMAL', NOW() - INTERVAL '10 minutes', '{"source":"seed"}'),
    ('event-demo-2', 'session-demo', 'student-demo', 'board-demo', 'element-more', 'Mais', 'ELEMENT_TYPE_NORMAL', NOW() - INTERVAL '5 minutes', '{"source":"seed"}')
ON CONFLICT (id) DO NOTHING;
