-- Cadastro mínimo do aluno/usuário observado.
CREATE TABLE IF NOT EXISTS students (
    id TEXT PRIMARY KEY,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Grades/pranchas utilizadas durante as sessões.
CREATE TABLE IF NOT EXISTS boards (
    id TEXT PRIMARY KEY,
    name TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Agrupa eventos de um mesmo período de uso.
CREATE TABLE IF NOT EXISTS usage_sessions (
    id TEXT PRIMARY KEY,
    student_id TEXT NOT NULL REFERENCES students(id),
    started_at TIMESTAMPTZ NOT NULL,
    last_seen_at TIMESTAMPTZ NOT NULL,
    ended_at TIMESTAMPTZ
);

-- Fato principal da análise: uma ativação realizada pelo usuário.
CREATE TABLE IF NOT EXISTS interaction_events (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL REFERENCES usage_sessions(id),
    student_id TEXT NOT NULL REFERENCES students(id),
    board_id TEXT NOT NULL REFERENCES boards(id),
    element_id TEXT NOT NULL,
    label TEXT,
    interaction_type TEXT,
    occurred_at TIMESTAMPTZ NOT NULL,
    session_duration_seconds INTEGER,
    -- JSONB permite acrescentar metadados sem alterar a tabela.
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

-- Acelera filtros por aluno e período.
CREATE INDEX IF NOT EXISTS interaction_events_student_time_idx
    ON interaction_events (student_id, occurred_at);
-- Acelera a contagem e consulta de sessões.
CREATE INDEX IF NOT EXISTS interaction_events_session_idx
    ON interaction_events (session_id);
-- Acelera a identificação dos itens mais usados.
CREATE INDEX IF NOT EXISTS interaction_events_item_idx
    ON interaction_events (board_id, element_id);
