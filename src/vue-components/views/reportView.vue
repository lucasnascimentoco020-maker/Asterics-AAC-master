<template>
  <section class="report-page">
    <header class="report-header">
      <div>
        <p class="eyebrow"><i class="fas fa-chart-line"></i> ACOMPANHAMENTO</p>
        <h1>Relatório de uso</h1>
        <p class="subtitle">Uma visão rápida das interações registradas no aplicativo.</p>
      </div>
      <button class="refresh-button" type="button" :disabled="loading" @click="loadReport" title="Atualizar relatório">
        <i class="fas fa-sync-alt" :class="{ 'fa-spin': loading }"></i>
        <span>Atualizar</span>
      </button>
    </header>

    <div v-if="loading" class="state-panel"><i class="fas fa-circle-notch fa-spin"></i><span>Carregando relatório...</span></div>
    <div v-else-if="error" class="state-panel state-error">
      <i class="fas fa-exclamation-triangle"></i><span>{{ error }}</span>
      <button type="button" @click="loadReport">Tentar novamente</button>
    </div>

    <div v-else>
      <form class="filters" @submit.prevent="loadReport">
        <label><span>Aluno</span><select v-model="filters.userId" @change="loadReport"><option value="">Selecione um aluno</option><option v-for="user in availableUsers" :key="user" :value="user">{{ user }}</option></select></label>
        <label><span>De</span><input v-model="filters.from" type="date"></label>
        <label><span>Até</span><input v-model="filters.to" type="date"></label>
        <button class="filter-button" type="submit"><i class="fas fa-filter"></i> Filtrar</button>
        <button v-if="hasFilters" class="clear-button" type="button" @click="clearFilters">Limpar</button>
      </form>

      <div v-if="!filters.userId" class="empty-panel"><i class="fas fa-user-check"></i><h2>Selecione um aluno</h2><p>Os registros do relatório serão carregados após a seleção.</p></div>

      <template v-else>
      <div class="report-meta">
        <span><i class="fas fa-database"></i> Banco: <strong>{{ currentUserId }}</strong></span>
        <span v-if="report.generatedAt">Atualizado {{ formatDate(report.generatedAt) }}</span>
      </div>

      <div class="summary-grid">
        <article class="summary-card summary-card-primary"><span class="summary-icon"><i class="fas fa-hand-pointer"></i></span><div><span class="summary-label">Total de interações</span><strong>{{ report.totalInteractions }}</strong></div></article>
        <article class="summary-card"><span class="summary-icon"><i class="fas fa-layer-group"></i></span><div><span class="summary-label">Sessões registradas</span><strong>{{ report.totalSessions }}</strong></div></article>
        <article class="summary-card"><span class="summary-icon"><i class="fas fa-th-large"></i></span><div><span class="summary-label">Elementos utilizados</span><strong>{{ report.mostUsedElements.length }}</strong></div></article>
      </div>

      <section class="feedback-panel ai-analysis-panel">
        <div class="feedback-heading">
          <div>
            <p class="panel-kicker">ANÁLISE SOB DEMANDA</p>
            <h2>Última análise da IA</h2>
            <p v-if="report.lastAiAnalysis && report.lastAiAnalysis.generatedAt" class="feedback-source">Gerada em {{ formatDate(report.lastAiAnalysis.generatedAt) }}</p>
          </div>
          <button class="analyze-button" type="button" :disabled="analyzingAi || !report.totalInteractions" @click="runAiAnalysis">
            <i class="fas fa-brain" :class="{ 'fa-spin': analyzingAi }"></i>
            <span>{{ analyzingAi ? 'Analisando...' : 'Faça uma análise neste usuário' }}</span>
          </button>
        </div>
        <p v-if="aiAnalysisError" class="analysis-error" role="alert">{{ aiAnalysisError }}</p>
        <template v-if="report.lastAiAnalysis">
          <div class="feedback-summary"><i class="fas fa-lightbulb"></i><p>{{ report.lastAiAnalysis.feedback.summary }}</p></div>
          <div class="feedback-columns">
            <div><h3><i class="fas fa-eye"></i> O que os registros mostram</h3><ul><li v-for="observation in report.lastAiAnalysis.feedback.observations" :key="observation">{{ observation }}</li></ul></div>
            <div><h3><i class="fas fa-compass"></i> Como observar</h3><ul><li v-for="interpretation in report.lastAiAnalysis.feedback.interpretations" :key="interpretation">{{ interpretation }}</li></ul></div>
            <div><h3><i class="fas fa-list-check"></i> Sugestões práticas</h3><ul><li v-for="recommendation in report.lastAiAnalysis.feedback.recommendations" :key="recommendation">{{ recommendation }}</li></ul></div>
          </div>
        </template>
        <p v-else class="feedback-empty">Sem ultima analise</p>
        <p class="feedback-note"><i class="fas fa-shield-heart"></i> A análise é mantida para consulta e pode não refletir interações registradas após a data de geração.</p>
      </section>

      <section v-if="report.pedagogicalFeedback" class="feedback-panel">
        <div class="feedback-heading">
          <div>
            <p class="panel-kicker">APOIO À PROFESSORA</p>
            <h2>Devolutiva pedagógica</h2>
            <p class="feedback-source">Síntese baseada em indicadores de uso</p>
          </div>
          <i class="fas fa-seedling"></i>
        </div>
        <div class="feedback-summary">
          <i class="fas fa-lightbulb"></i>
          <p>{{ report.pedagogicalFeedback.summary }}</p>
        </div>
        <div class="feedback-columns">
          <div>
            <h3><i class="fas fa-eye"></i> O que os registros mostram</h3>
            <ul><li v-for="observation in report.pedagogicalFeedback.observations" :key="observation">{{ observation }}</li></ul>
          </div>
          <div>
            <h3><i class="fas fa-compass"></i> Como observar</h3>
            <ul><li v-for="interpretation in report.pedagogicalFeedback.interpretations" :key="interpretation">{{ interpretation }}</li></ul>
          </div>
          <div>
            <h3><i class="fas fa-list-check"></i> Sugestões práticas</h3>
            <ul><li v-for="recommendation in report.pedagogicalFeedback.recommendations" :key="recommendation">{{ recommendation }}</li></ul>
          </div>
        </div>
        <p class="feedback-note"><i class="fas fa-shield-heart"></i> Esta devolutiva apoia o planejamento e deve ser considerada junto à observação da professora e ao contexto das atividades. Não constitui diagnóstico clínico ou laudo.</p>
      </section>

      <div v-if="!report.totalInteractions" class="empty-panel"><i class="fas fa-chart-bar"></i><h2>Nenhuma interação neste filtro</h2><p>Use o aplicativo ou ajuste os filtros para visualizar os dados registrados.</p></div>

      <div v-else class="report-grid">
        <section class="report-panel">
          <div class="panel-heading"><div><p class="panel-kicker">DESTAQUES</p><h2>Elementos mais usados</h2></div><i class="fas fa-ranking-star"></i></div>
          <ol class="ranking-list"><li v-for="(item, index) in report.mostUsedElements" :key="item[0]"><span class="rank">{{ index + 1 }}</span><span class="item-name" :title="item[0]">{{ item[0] }}</span><strong>{{ item[1] }}</strong></li></ol>
        </section>

        <section v-if="report.mostUsedCombinations && report.mostUsedCombinations.length" class="report-panel">
          <div class="panel-heading"><div><p class="panel-kicker">SEQUÊNCIAS</p><h2>Combinações mais frequentes</h2></div><i class="fas fa-link"></i></div>
          <ol class="combination-list"><li v-for="(combination, index) in report.mostUsedCombinations" :key="index"><span class="rank">{{ index + 1 }}</span><span>{{ combination.items.join(' + ') }}</span><strong>{{ combination.count }}</strong></li></ol>
        </section>

        <section class="report-panel">
          <div class="panel-heading"><div><p class="panel-kicker">DISTRIBUIÇÃO</p><h2>Tipos de ação</h2></div><i class="fas fa-bolt"></i></div>
          <ul class="metric-list"><li v-for="item in report.interactionsByActionType" :key="item[0]"><span>{{ item[0] }}</span><div class="metric-track"><span :style="{ width: metricWidth(item[1], report.interactionsByActionType) }"></span></div><strong>{{ item[1] }}</strong></li></ul>
        </section>

        <section class="report-panel">
          <div class="panel-heading"><div><p class="panel-kicker">EVOLUÇÃO</p><h2>Uso por dia</h2></div><i class="fas fa-calendar-day"></i></div>
          <ul class="day-list"><li v-for="item in report.interactionsByDay" :key="item[0]"><span>{{ item[0] }}</span><strong>{{ item[1] }} <small>{{ item[1] === 1 ? 'interação' : 'interações' }}</small></strong></li></ul>
        </section>

        <section class="report-panel history-panel">
          <div class="panel-heading"><div><p class="panel-kicker">ATIVIDADE</p><h2>Histórico recente</h2></div><i class="fas fa-clock-rotate-left"></i></div>
          <ul class="history-list"><li v-for="interaction in report.userHistory" :key="interaction.id"><span class="history-dot"></span><div><strong>{{ itemLabel(interaction) }}</strong><span>{{ formatDate(interaction.timestamp) }} <em>{{ interaction.actionType || 'ação' }}</em></span></div></li></ul>
        </section>
      </div>
      </template>
    </div>
  </section>
</template>

<script>
import { reportService } from '../../js/service/data/reportService';
import { localStorageService } from '../../js/service/data/localStorageService';

export default {
  data() {
    return { report: this.emptyReport(), loading: true, error: '', aiAnalysisError: '', analyzingAi: false, availableUsers: [], filters: { userId: '', from: '', to: '' } };
  },
  computed: {
    currentUserId() { return reportService.getCurrentUserId(); },
    hasFilters() { return Boolean(this.filters.userId || this.filters.from || this.filters.to); }
  },
  mounted() {
    this.availableUsers = localStorageService.getSavedUsers(reportService.getCurrentUserId());
    this.loadReport();
  },
  methods: {
    async loadReport() {
      this.loading = true;
      this.error = '';
      this.aiAnalysisError = '';
      if (!this.filters.userId) {
        this.report = this.emptyReport();
        this.loading = false;
        return;
      }
      try { this.report = await reportService.generateUsageReport(this.filters); }
      catch (err) { this.report = this.emptyReport(); this.error = 'Não foi possível carregar o relatório: ' + (err && err.message ? err.message : err); }
      finally { this.loading = false; }
    },
    async runAiAnalysis() {
      if (!this.filters.userId || !this.report.totalInteractions || this.analyzingAi) return;
      this.analyzingAi = true;
      this.aiAnalysisError = '';
      try {
        this.report.lastAiAnalysis = await reportService.generateAiAnalysis(this.report, this.filters);
      } catch (err) {
        this.aiAnalysisError = err && err.message ? err.message : 'Não foi possível gerar a análise.';
      } finally {
        this.analyzingAi = false;
      }
    },
    clearFilters() { this.filters = { userId: '', from: '', to: '' }; this.loadReport(); },
    formatDate(timestamp) {
      const date = new Date(timestamp);
      return Number.isNaN(date.getTime()) ? 'Data desconhecida' : date.toLocaleString('pt-BR');
    },
    itemLabel(interaction) {
      if (typeof interaction.label === 'string' && interaction.label.trim()) return interaction.label;
      if (interaction.label && typeof interaction.label === 'object') return Object.values(interaction.label).find(Boolean) || interaction.elementId;
      return interaction.elementId || 'Elemento sem nome';
    },
    metricWidth(value, items) {
      const max = items.length ? Math.max(...items.map(item => item[1])) : 1;
      return Math.max(8, (value / max) * 100) + '%';
    },
    emptyReport() {
      return {
        generatedAt: null,
        totalInteractions: 0,
        totalSessions: 0,
        mostUsedElements: [],
        interactionsByActionType: [],
        mostUsedCombinations: [],
        interactionsByDay: [],
        userHistory: [],
        pedagogicalFeedbackSource: 'indicators',
        pedagogicalFeedbackGeneratedAt: null,
        lastAiAnalysis: null,
        pedagogicalFeedback: {
          summary: 'Ainda não há interações suficientes para elaborar uma devolutiva pedagógica.',
          observations: [],
          interpretations: [],
          recommendations: []
        }
      };
    }
  }
};
</script>

<style scoped>
.report-page { min-height: 100%; padding: 2.5rem clamp(1rem, 4vw, 4rem); color: #18324a; background: linear-gradient(135deg, #f5f9fc 0%, #eef4f2 100%); font-size: 1.05rem; }
.report-header, .filters, .report-meta, .summary-grid, .report-grid { max-width: 1180px; margin-left: auto; margin-right: auto; }
.report-header { display: flex; align-items: flex-end; justify-content: space-between; gap: 1.5rem; margin-bottom: 2rem; }
.eyebrow, .panel-kicker { margin: 0 0 .35rem; color: #258b85; font-size: .72rem; font-weight: 800; letter-spacing: .12em; }
h1 { margin: 0; color: #12344d; font-size: clamp(1.8rem, 4vw, 2.8rem); font-weight: 800; }
.subtitle { margin: .5rem 0 0; color: #678093; font-size: 1.05rem; }
button { border: 0; cursor: pointer; font: inherit; }
.refresh-button, .filter-button { display: inline-flex; align-items: center; gap: .5rem; border-radius: .45rem; padding: .75rem 1rem; color: #fff; background: #177d7a; font-weight: 700; }
.refresh-button:disabled { opacity: .65; cursor: wait; }
.analyze-button { display: inline-flex; align-items: center; justify-content: center; gap: .55rem; min-height: 2.75rem; max-width: 100%; border-radius: .45rem; padding: .65rem .9rem; color: #fff; background: #177d7a; font-weight: 700; }
.analyze-button:disabled { opacity: .6; cursor: wait; }
.analysis-error { margin: 0 0 1rem; color: #a54c4c; }
.filters { display: flex; flex-wrap: wrap; align-items: flex-end; gap: .85rem; padding: 1rem; border: 1px solid #d7e4e8; border-radius: .55rem; background: rgba(255,255,255,.78); box-shadow: 0 8px 24px rgba(35,70,90,.06); }
.filters label { display: flex; flex: 1 1 150px; flex-direction: column; gap: .3rem; color: #537083; font-size: .9rem; font-weight: 700; }
.filters input, .filters select { min-height: 2.65rem; box-sizing: border-box; border: 1px solid #c9d9df; border-radius: .35rem; padding: .55rem .7rem; color: #18324a; background: #fff; }
.filters input:focus, .filters select:focus { outline: 2px solid rgba(37,139,133,.25); border-color: #258b85; }
.clear-button { padding: .75rem .5rem; color: #39707a; background: transparent; font-weight: 700; }
.report-meta { display: flex; justify-content: space-between; gap: 1rem; padding: .85rem .15rem 1.25rem; color: #708795; font-size: .95rem; }
.report-meta strong { color: #31586b; }
.summary-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; margin-bottom: 1rem; }
.summary-card { display: flex; align-items: center; gap: 1rem; padding: 1.25rem; border: 1px solid #d8e5e6; border-radius: .55rem; background: #fff; box-shadow: 0 8px 25px rgba(35,70,90,.06); }
.summary-card-primary { color: #fff; border-color: #177d7a; background: #177d7a; }
.summary-icon { display: grid; width: 2.65rem; height: 2.65rem; place-items: center; border-radius: .45rem; color: #177d7a; background: #e2f1ef; font-size: 1.1rem; }
.summary-card-primary .summary-icon { color: #fff; background: rgba(255,255,255,.18); }
.summary-label { display: block; margin-bottom: .3rem; color: #75909d; font-size: .9rem; font-weight: 700; }
.summary-card-primary .summary-label { color: rgba(255,255,255,.78); }
.summary-card strong { display: block; font-size: 1.65rem; }
.feedback-panel { max-width: 1180px; margin: 0 auto 1rem; padding: 1.5rem; border: 1px solid #c9e0dc; border-radius: .55rem; background: #f7fcfb; box-shadow: 0 10px 28px rgba(35,70,90,.07); }
.feedback-heading { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 1rem; }
.feedback-heading h2 { margin: 0; color: #174e59; font-size: 1.3rem; }
.feedback-source { margin: .3rem 0 0; color: #718b92; font-size: .85rem; }
.feedback-heading > i { color: #3c9a8d; font-size: 1.45rem; }
.feedback-summary { display: flex; align-items: flex-start; gap: .8rem; margin-bottom: 1.25rem; padding: 1rem; border-left: 4px solid #3c9a8d; border-radius: .35rem; color: #234f5a; background: #e6f4f1; }
.feedback-summary i { margin-top: .15rem; color: #288277; }
.feedback-summary p { margin: 0; line-height: 1.55; }
.feedback-columns { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1.25rem; }
.feedback-columns h3 { display: flex; align-items: center; gap: .45rem; margin: 0 0 .65rem; color: #31586b; font-size: .9rem; }
.feedback-columns h3 i { color: #3c9a8d; }
.feedback-columns ul { margin: 0; padding-left: 1.1rem; color: #587583; font-size: .98rem; line-height: 1.55; }
.feedback-columns li { margin-bottom: .6rem; }
.feedback-note { margin: 1.25rem 0 0; padding-top: .9rem; border-top: 1px solid #d8ebe7; color: #718b92; font-size: .88rem; }
.feedback-note i { margin-right: .35rem; color: #3c9a8d; }
.report-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1rem; }
.report-panel { min-width: 0; padding: 1.35rem; border: 1px solid #d8e5e6; border-radius: .55rem; background: #fff; box-shadow: 0 8px 25px rgba(35,70,90,.06); }
.history-panel { grid-column: span 2; }
.panel-heading { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 1rem; }
.panel-heading h2 { margin: 0; color: #1b4059; font-size: 1.05rem; }
.panel-heading > i { color: #68a9a0; font-size: 1.2rem; }
.ranking-list, .metric-list, .day-list, .history-list { margin: 0; padding: 0; list-style: none; }
.combination-list { margin: 0; padding: 0; list-style: none; }
.combination-list li { display: flex; align-items: center; gap: .7rem; min-height: 2.5rem; border-bottom: 1px solid #edf2f2; }
.combination-list li:last-child { border-bottom: 0; }
.combination-list li > span:nth-child(2) { flex: 1; overflow-wrap: anywhere; color: #47697a; }
.combination-list strong { color: #1b4059; }
.ranking-list li, .metric-list li, .day-list li { display: flex; align-items: center; gap: .7rem; min-height: 2.5rem; border-bottom: 1px solid #edf2f2; }
.ranking-list li:last-child, .metric-list li:last-child, .day-list li:last-child { border-bottom: 0; }
.rank { display: grid; width: 1.5rem; height: 1.5rem; place-items: center; border-radius: 50%; color: #177d7a; background: #e2f1ef; font-size: .75rem; font-weight: 800; }
.item-name, .metric-list li > span, .day-list li > span { flex: 1; overflow: hidden; color: #47697a; text-overflow: ellipsis; white-space: nowrap; }
.ranking-list strong, .metric-list strong, .day-list strong { color: #1b4059; }
.metric-track { flex: 1; height: .42rem; overflow: hidden; border-radius: 1rem; background: #eaf1f1; }
.metric-track span { display: block; height: 100%; border-radius: inherit; background: #4fa89d; }
.day-list small { color: #8aa0a8; font-weight: 400; }
.history-list { display: grid; grid-template-columns: repeat(2, 1fr); column-gap: 2rem; }
.history-list li { display: flex; align-items: flex-start; gap: .7rem; padding: .7rem 0; border-bottom: 1px solid #edf2f2; }
.history-dot { width: .55rem; height: .55rem; flex: 0 0 auto; margin-top: .35rem; border-radius: 50%; background: #4fa89d; box-shadow: 0 0 0 4px #e5f2f0; }
.history-list strong, .history-list span { display: block; }
.history-list strong { color: #31586b; font-size: 1rem; }
.history-list div > span { margin-top: .25rem; color: #879ba4; font-size: .88rem; }
.history-list em { margin-left: .4rem; color: #4b8e8b; font-style: normal; }
.empty-panel, .state-panel { max-width: 1180px; margin: 1rem auto; padding: 3.5rem 1rem; border: 1px dashed #bed4d5; border-radius: .55rem; color: #6b8993; text-align: center; background: rgba(255,255,255,.65); }
.empty-panel > i { color: #65aaa1; font-size: 2rem; }
.empty-panel h2 { margin: .8rem 0 .35rem; color: #31586b; font-size: 1.2rem; }
.empty-panel p { margin: 0; }
.state-panel { display: flex; align-items: center; justify-content: center; gap: .7rem; }
.state-error { color: #a54c4c; }
.state-error button { margin-left: .5rem; color: #177d7a; background: transparent; font-weight: 700; }
@media (max-width: 900px) { .feedback-columns { grid-template-columns: 1fr; gap: .75rem; } }
@media (max-width: 720px) { .report-page { padding: 1.25rem .8rem; } .report-header { align-items: flex-start; flex-direction: column; } .refresh-button { align-self: stretch; justify-content: center; } .feedback-heading { flex-direction: column; gap: .8rem; } .analyze-button { align-self: stretch; } .report-meta { align-items: flex-start; flex-direction: column; gap: .35rem; } .summary-grid, .report-grid { grid-template-columns: 1fr; } .history-panel { grid-column: auto; } .history-list { grid-template-columns: 1fr; } }
</style>
