<template>
  <div class="report-view box">
    <h1>Relatório de Uso</h1>

    <div v-if="loading" class="loading">Carregando relatório...</div>

    <div v-else-if="error" class="error">{{ error }}</div>

    <div v-else>
      <p><strong>Total de interações:</strong> {{ report.totalInteractions }}</p>

      <h2>Elementos mais usados</h2>
      <ul>
        <li v-for="item in report.mostUsedElements" :key="item[0]">
          {{ item[0] }} — {{ item[1] }} vezes
        </li>
      </ul>

      <h2>Interações por tipo de ação</h2>
      <ul>
        <li v-for="item in report.interactionsByActionType" :key="item[0]">
          {{ item[0] }} — {{ item[1] }}
        </li>
      </ul>

      <h2>Uso por dia</h2>
      <ul>
        <li v-for="item in report.interactionsByDay" :key="item[0]">
          {{ item[0] }} — {{ item[1] }} interações
        </li>
      </ul>
    </div>
  </div>
</template>

<script>
import { reportService } from '../../js/service/data/reportService';

export default {
  data() {
    return {
      report: null,
      loading: true,
      error: ''
    };
  },
  async mounted() {
    try {
      this.report = await reportService.generateUsageReport();
    } catch (err) {
      this.error = 'Erro ao gerar relatório: ' + err;
    } finally {
      this.loading = false;
    }
  }
};
</script>

<style scoped>
.report-view {
  padding: 1.5em;
}
.loading {
  color: #888;
}
.error {
  color: #c00;
}
</style>
