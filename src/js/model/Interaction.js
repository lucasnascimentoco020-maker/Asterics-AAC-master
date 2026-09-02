import { Model } from '../externals/objectmodel';
import { modelUtil } from '../util/modelUtil';
import { constants } from '../util/constants';

class Interaction extends Model({
    id: String,
    modelName: String,
    modelVersion: String,
    userId: String,
    sessionId: String,
    gridId: String,
    context: [String, undefined],
    elementId: String,
    label: [String, undefined],
    actionType: [String, undefined],
    timestamp: [Number, String],
    sessionDurationSeconds: [Number, undefined],
    metadata: [Object, undefined]
}) {
    constructor(properties) {
        let defaults = JSON.parse(JSON.stringify(Interaction.DEFAULTS));
        properties = modelUtil.setDefaults(properties, undefined, Interaction) || {};
        super(Object.assign(defaults, properties));
        this.id = this.id || modelUtil.generateId(Interaction.ID_PREFIX);
        this.timestamp = this.timestamp || Date.now();
    }

    static getModelName() {
        return 'Interaction';
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
