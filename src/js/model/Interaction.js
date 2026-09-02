import { Model } from '../externals/objectmodel';
import { modelUtil } from '../util/modelUtil';
import { constants } from '../util/constants';

class Interaction extends Model({
    id: String,
    modelName: String,
    modelVersion: String,
    userId: String,
    gridId: String,
    elementId: String,
    label: [String, undefined],
    actionType: [String, undefined],
    timestamp: [Number, String]
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
    gridId: '',
    elementId: '',
    label: undefined,
    actionType: undefined,
    timestamp: undefined
};
export { Interaction };