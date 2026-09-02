import { Model } from '../externals/objectmodel';
import { modelUtil } from '../util/modelUtil';
import { constants } from '../util/constants';

// Representa uma ativação de elemento feita pelo usuário no aplicativo.
// O modelo é validado pelo ObjectModel antes de ser persistido no PouchDB.
class Interaction extends Model({
    // Identificador único do evento, usado também como _id no PouchDB/PostgreSQL.
    id: String,
    // Identificação do tipo e da versão do modelo armazenado.
    modelName: String,
    modelVersion: String,
    // Usuário/aluno associado à interação.
    userId: String,
    // Agrupa eventos realizados durante a mesma sessão de uso.
    sessionId: String,
    // Identifica a grade ou prancha que estava aberta.
    gridId: String,
    // Nome ou contexto legível da grade, quando disponível.
    context: [String, undefined],
    // Identificador técnico do elemento ativado.
    elementId: String,
    // Texto exibido para o elemento no idioma atual.
    label: [String, undefined],
    // Tipo funcional do elemento, por exemplo, elemento normal ou previsão.
    actionType: [String, undefined],
    // Momento da ativação em milissegundos ou em formato textual.
    timestamp: [Number, String],
    // Tempo aproximado desde o início da sessão até este evento.
    sessionDurationSeconds: [Number, undefined],
    // Informações adicionais para análises futuras sem alterar o esquema principal.
    metadata: [Object, undefined]
}) {
    constructor(properties) {
        // Copia os valores padrão para que cada evento tenha seu próprio objeto.
        let defaults = JSON.parse(JSON.stringify(Interaction.DEFAULTS));
        // Preenche propriedades ausentes respeitando as regras do modelo.
        properties = modelUtil.setDefaults(properties, undefined, Interaction) || {};
        super(Object.assign(defaults, properties));
        // Gera o ID somente quando o chamador não forneceu um identificador.
        this.id = this.id || modelUtil.generateId(Interaction.ID_PREFIX);
        // Registra o instante da criação se o evento ainda não tiver timestamp.
        this.timestamp = this.timestamp || Date.now();
    }

    static getModelName() {
        return 'Interaction';
    }

    static getIdPrefix() {
        // O databaseService usa este prefixo para consultar documentos do modelo.
        return Interaction.ID_PREFIX;
    }
}

Interaction.ID_PREFIX = "interaction";
Interaction.DEFAULTS = {
    id: '',
    modelName: Interaction.getModelName(),
    modelVersion: constants.MODEL_VERSION,
    userId: '',
    sessionId: '',
    gridId: '',
    context: undefined,
    elementId: '',
    label: undefined,
    actionType: undefined,
    timestamp: undefined,
    sessionDurationSeconds: undefined,
    metadata: undefined
};
export { Interaction };
