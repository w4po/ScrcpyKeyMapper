import { BaseNode } from './BaseNode.js';
import { KeyDisplayManager } from '../managers/KeyDisplayManager.js';

export class ClickNode extends BaseNode {
    constructor(stage, mappingData) {
        super(stage, mappingData.type, mappingData);

        this.mappingData = {
            ...mappingData,
            pos: mappingData.pos || { x: 0.5, y: 0.5 },
            key: mappingData.key || '',
            switchMap: mappingData.switchMap || false
        };
        this.shape = this.createShape();
        this.setupEvents();
    }

    createShape() {
        const denormalized = window.scaleManager.denormalizePosition(this.mappingData.pos);
        const group = new Konva.Group({
            x: denormalized.x,
            y: denormalized.y,
            draggable: true,
            name: 'mainShape'
        });

        // Set color based on type
        const color = this.mappingData.type === 'KMT_CLICK' ? '#0056b3' : '#1e7e34';

        // Create the key shape using KeyDisplayManager with key change callback
        const keyDisplay = KeyDisplayManager.createKeyShape(
            this.mappingData.key, 
            color, 
            'transparent', 
            2, 
            (newKey) => this.setKey(newKey)
        );

        group.add(keyDisplay.group);

        return group;
    }

    get supportsKey() {
        return true;
    }

    setKey(key) {
        this.mappingData.key = key;
        
        // Update the key display
        KeyDisplayManager.updateKeyShape(this.shape, key);

        // Update the form input
        const mappingKeyProperties = document.getElementById('mappingKeyProperties');
        if (mappingKeyProperties) {
            mappingKeyProperties.value = key;
        }
    }

    setupEvents() {
        // Handle dragging
        this.shape.on('dragmove', () => {
            const pos = window.scaleManager.normalizePosition(this.shape.x(), this.shape.y());
            const constrained = window.scaleManager.constrainPosition(pos.x, pos.y);
            const denormalized = window.scaleManager.denormalizePosition(constrained);
            this.shape.x(denormalized.x);
            this.shape.y(denormalized.y);
        });

        this.shape.on('dragend', () => {
            this.updateMappingData();
        });

        // Handle selection
        this.shape.on('mousedown touchstart', () => {
            this.shape.fire('select');
        });

        this.shape.on('select', () => this.updateSelection(true));
        this.shape.on('deselect', () => this.updateSelection(false));
    }

    updateSelection(selected) {
        if (!this.shape) return;

        const keyShape = this.shape.findOne('.keyShape');
        if (keyShape) {
            keyShape.strokeWidth(selected ? 2 : 1);
            keyShape.shadowEnabled(selected);
            keyShape.shadowColor('black');
            keyShape.shadowBlur(10);
            keyShape.shadowOpacity(0.5);
            keyShape.shadowOffset({ x: 2, y: 2 });
        }
    }

    updateMappingData() {
        this.mappingData.pos = window.scaleManager.normalizePosition(this.shape.x(), this.shape.y());
    }
}
