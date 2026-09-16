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
        <label><span>Aluno</span><input v-model.trim="filters.userId" type="text" placeholder="Todos os usuários"></label>
        <label><span>De</span><input v-model="filters.from" type="date"></label>
        <label><span>Até</span><input v-model="filters.to" type="date"></label>
        <button class="filter-button" type="submit"><i class="fas fa-filter"></i> Filtrar</button>
        <button v-if="hasFilters" class="clear-button" type="button" @click="clearFilters">Limpar</button>
      </form>

      <div class="report-meta">
        <span><i class="fas fa-database"></i> Banco: <strong>{{ currentUserId }}</strong></span>
        <span v-if="report.generatedAt">Atualizado {{ formatDate(report.generatedAt) }}</span>
      </div>

      <div class="summary-grid">
        <article class="summary-card summary-card-primary"><span class="summary-icon"><i class="fas fa-hand-pointer"></i></span><div><span class="summary-label">Total de interações</span><strong>{{ report.totalInteractions }}</strong></div></article>
        <article class="summary-card"><span class="summary-icon"><i class="fas fa-layer-group"></i></span><div><span class="summary-label">Sessões registradas</span><strong>{{ report.totalSessions }}</strong></div></article>
        <article class="summary-card"><span class="summary-icon"><i class="fas fa-th-large"></i></span><div><span class="summary-label">Elementos utilizados</span><strong>{{ report.mostUsedElements.length }}</strong></div></article>
      </div>

      <div v-if="!report.totalInteractions" class="empty-panel"><i class="fas fa-chart-bar"></i><h2>Nenhuma interação neste filtro</h2><p>Use o aplicativo ou ajuste os filtros para visualizar os dados registrados.</p></div>

      <div v-else class="report-grid">
        <section class="report-panel">
          <div class="panel-heading"><div><p class="panel-kicker">DESTAQUES</p><h2>Elementos mais usados</h2></div><i class="fas fa-ranking-star"></i></div>
          <ol class="ranking-list"><li v-for="(item, index) in report.mostUsedElements" :key="item[0]"><span class="rank">{{ index + 1 }}</span><span class="item-name" :title="item[0]">{{ item[0] }}</span><strong>{{ item[1] }}</strong></li></ol>
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
    </div>
  </section>
</template>

<script>
import { reportService } from '../../js/service/data/reportService';

export default {
  data() {
    return { report: this.emptyReport(), loading: true, error: '', filters: { userId: '', from: '', to: '' } };
  },
  computed: {
    currentUserId() { return reportService.getCurrentUserId(); },
    hasFilters() { return Boolean(this.filters.userId || this.filters.from || this.filters.to); }
  },
  mounted() { this.loadReport(); },
  methods: {
    async loadReport() {
      this.loading = true;
      this.error = '';
      try { this.report = await reportService.generateUsageReport(this.filters); }
      catch (err) { this.report = this.emptyReport(); this.error = 'Não foi possível carregar o relatório: ' + (err && err.message ? err.message : err); }
      finally { this.loading = false; }
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
    emptyReport() { return { generatedAt: null, totalInteractions: 0, totalSessions: 0, mostUsedElements: [], interactionsByActionType: [], interactionsByDay: [], userHistory: [] }; }
  }
};
</script>

<style scoped>
.report-page { min-height: 100%; padding: 2.5rem clamp(1rem, 4vw, 4rem); color: #18324a; background: linear-gradient(135deg, #f5f9fc 0%, #eef4f2 100%); }
.report-header, .filters, .report-meta, .summary-grid, .report-grid { max-width: 1180px; margin-left: auto; margin-right: auto; }
.report-header { display: flex; align-items: flex-end; justify-content: space-between; gap: 1.5rem; margin-bottom: 2rem; }
.eyebrow, .panel-kicker { margin: 0 0 .35rem; color: #258b85; font-size: .72rem; font-weight: 800; letter-spacing: .12em; }
h1 { margin: 0; color: #12344d; font-size: clamp(1.8rem, 4vw, 2.8rem); font-weight: 800; }
.subtitle { margin: .5rem 0 0; color: #678093; }
button { border: 0; cursor: pointer; font: inherit; }
.refresh-button, .filter-button { display: inline-flex; align-items: center; gap: .5rem; border-radius: .45rem; padding: .75rem 1rem; color: #fff; background: #177d7a; font-weight: 700; }
.refresh-button:disabled { opacity: .65; cursor: wait; }
.filters { display: flex; flex-wrap: wrap; align-items: flex-end; gap: .85rem; padding: 1rem; border: 1px solid #d7e4e8; border-radius: .55rem; background: rgba(255,255,255,.78); box-shadow: 0 8px 24px rgba(35,70,90,.06); }
.filters label { display: flex; flex: 1 1 150px; flex-direction: column; gap: .3rem; color: #537083; font-size: .78rem; font-weight: 700; }
.filters input { min-height: 2.65rem; box-sizing: border-box; border: 1px solid #c9d9df; border-radius: .35rem; padding: .55rem .7rem; color: #18324a; background: #fff; }
.filters input:focus { outline: 2px solid rgba(37,139,133,.25); border-color: #258b85; }
.clear-button { padding: .75rem .5rem; color: #39707a; background: transparent; font-weight: 700; }
.report-meta { display: flex; justify-content: space-between; gap: 1rem; padding: .85rem .15rem 1.25rem; color: #708795; font-size: .8rem; }
.report-meta strong { color: #31586b; }
.summary-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; margin-bottom: 1rem; }
.summary-card { display: flex; align-items: center; gap: 1rem; padding: 1.25rem; border: 1px solid #d8e5e6; border-radius: .55rem; background: #fff; box-shadow: 0 8px 25px rgba(35,70,90,.06); }
.summary-card-primary { color: #fff; border-color: #177d7a; background: #177d7a; }
.summary-icon { display: grid; width: 2.65rem; height: 2.65rem; place-items: center; border-radius: .45rem; color: #177d7a; background: #e2f1ef; font-size: 1.1rem; }
.summary-card-primary .summary-icon { color: #fff; background: rgba(255,255,255,.18); }
.summary-label { display: block; margin-bottom: .3rem; color: #75909d; font-size: .78rem; font-weight: 700; }
.summary-card-primary .summary-label { color: rgba(255,255,255,.78); }
.summary-card strong { display: block; font-size: 1.65rem; }
.report-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1rem; }
.report-panel { min-width: 0; padding: 1.35rem; border: 1px solid #d8e5e6; border-radius: .55rem; background: #fff; box-shadow: 0 8px 25px rgba(35,70,90,.06); }
.history-panel { grid-column: span 2; }
.panel-heading { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 1rem; }
.panel-heading h2 { margin: 0; color: #1b4059; font-size: 1.05rem; }
.panel-heading > i { color: #68a9a0; font-size: 1.2rem; }
.ranking-list, .metric-list, .day-list, .history-list { margin: 0; padding: 0; list-style: none; }
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
.history-list strong { color: #31586b; font-size: .9rem; }
.history-list div > span { margin-top: .25rem; color: #879ba4; font-size: .76rem; }
.history-list em { margin-left: .4rem; color: #4b8e8b; font-style: normal; }
.empty-panel, .state-panel { max-width: 1180px; margin: 1rem auto; padding: 3.5rem 1rem; border: 1px dashed #bed4d5; border-radius: .55rem; color: #6b8993; text-align: center; background: rgba(255,255,255,.65); }
.empty-panel > i { color: #65aaa1; font-size: 2rem; }
.empty-panel h2 { margin: .8rem 0 .35rem; color: #31586b; font-size: 1.2rem; }
.empty-panel p { margin: 0; }
.state-panel { display: flex; align-items: center; justify-content: center; gap: .7rem; }
.state-error { color: #a54c4c; }
.state-error button { margin-left: .5rem; color: #177d7a; background: transparent; font-weight: 700; }
@media (max-width: 720px) { .report-page { padding: 1.25rem .8rem; } .report-header { align-items: flex-start; flex-direction: column; } .refresh-button { align-self: stretch; justify-content: center; } .report-meta { align-items: flex-start; flex-direction: column; gap: .35rem; } .summary-grid, .report-grid { grid-template-columns: 1fr; } .history-panel { grid-column: auto; } .history-list { grid-template-columns: 1fr; } }
</style>
