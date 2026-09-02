# Relatórios de uso pedagógico

## Arquitetura

As ativações de elementos continuam sendo processadas por `actionService.doAction`. O evento é salvo primeiro no PouchDB já usado pelo aplicativo, permitindo funcionamento offline, e enviado em segundo plano para `/api/usage/events` quando o servidor Express e o PostgreSQL estão configurados. A tela existente de relatórios consulta a API e usa o PouchDB como fallback.

## Modelo de dados

- `students`: identifica o aluno/usuário observado.
- `boards`: identifica a grade ou prancha utilizada.
- `usage_sessions`: agrupa as interações de uma sessão e referencia o aluno.
- `interaction_events`: registra cada ativação, referencia aluno, sessão e prancha, e armazena item, tipo, horário, duração e metadados JSONB.

As chaves estrangeiras garantem integridade referencial. Índices por aluno/data, sessão e item apoiam os relatórios.

## Fluxo

`ativação do elemento -> actionService -> Interaction -> PouchDB local -> POST /api/usage/events -> PostgreSQL -> GET /api/usage/reports -> tela de relatório`

## Consultas disponíveis

`GET /api/usage/reports?userId=student-demo&from=2026-01-01&to=2026-02-01` retorna total de interações, sessões, itens mais usados, contagem diária e histórico recente.

As consultas SQL agrupam `COUNT(*)` por item e data e `COUNT(DISTINCT session_id)` para frequência de sessões. O arquivo `database/usage.sql` cria a estrutura e `database/seed.sql` fornece dados demonstrativos.

## Limitações e evolução

O identificador de aluno é o identificador local/autenticado disponível no cliente; não há ainda cadastro pedagógico separado. O encerramento exato da sessão depende da saída do navegador, então a duração é aproximada e atualizada a cada interação. A API aceita eventos idempotentes por `id`, mas ainda não implementa uma fila de reenvio dedicada para períodos offline prolongados.
