<template>
  <div class="report-view box">
    <h1>Relatório de Uso</h1>

    <div v-if="loading" class="loading">Carregando relatório...</div>

    <div v-else-if="error" class="error">{{ error }}</div>

    <div v-else>
      <!-- Os filtros permitem demonstrar um aluno e um período específicos. -->
      <div class="filters">
        <label>Aluno <input v-model.trim="filters.userId" placeholder="ID do aluno"></label>
        <label>De <input type="date" v-model="filters.from"></label>
        <label>Até <input type="date" v-model="filters.to"></label>
        <button type="button" @click="loadReport">Atualizar</button>
      </div>
      <!-- Mostra qual identificador foi usado para registrar os eventos locais. -->
      <p class="current-user">ID do usuário atual: <strong>{{ currentUserId }}</strong></p>
      <p><strong>Total de interações:</strong> {{ report.totalInteractions }}</p>
      <p><strong>Sessões registradas:</strong> {{ report.totalSessions }}</p>

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

      <h2>Histórico recente</h2>
      <ul>
        <li v-for="interaction in report.userHistory" :key="interaction.id">
          {{ formatDate(interaction.timestamp) }} — {{ itemLabel(interaction) }} ({{ interaction.userId }})
        </li>
      </ul>
    </div>
  </div>
</template>

<script>
import { reportService } from '../../js/service/data/reportService';

export default {
  mounted() {
    // Carrega o primeiro relatório assim que a tela é aberta.
    this.loadReport();
  },
  methods: {
    async loadReport() {
      // Mantém o estado visual consistente enquanto a consulta é executada.
      this.loading = true;
      this.error = '';
      try {
        this.report = await reportService.generateUsageReport(this.filters);
      } catch (err) {
        this.error = 'Erro ao gerar relatório: ' + err;
      } finally {
        this.loading = false;
      }
    },
    formatDate(timestamp) {
      return new Date(timestamp).toLocaleString();
    },
    itemLabel(interaction) {
      // Exibe no histórico o texto legível, em vez do objeto multilíngue bruto.
      if (typeof interaction.label === 'string') return interaction.label;
      if (interaction.label && typeof interaction.label === 'object') {
        return Object.values(interaction.label).find(Boolean) || interaction.elementId;
      }
      return interaction.elementId;
    }
  },
  data() {
    return {
      report: null,
      loading: true,
      error: '',
      // O usuário atual já vem selecionado para facilitar a demonstração.
      filters: {
        userId: reportService.getCurrentUserId(),
        from: '',
        to: ''
      }
    };
  },
  computed: {
    currentUserId() {
      return reportService.getCurrentUserId();
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
.filters {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75em;
  align-items: end;
  margin-bottom: 1em;
}
.filters label {
  display: flex;
  flex-direction: column;
  gap: 0.25em;
}
.current-user {
  color: #555;
}
</style>
