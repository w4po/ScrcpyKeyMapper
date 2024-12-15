import { BaseNode } from './BaseNode.js';
import { MAPPING_TYPES } from '../utils/constants.js';
import { KeyDisplayManager } from '../managers/KeyDisplayManager.js';

export class MouseMoveNode extends BaseNode {
    constructor(stage, mappingData) {
        super(stage, mappingData.type, mappingData);
        
        this.mappingData = {
            ...mappingData,
            startPos: mappingData.startPos || { x: 0.5, y: 0.5 },
            speedRatioX: parseFloat(mappingData.speedRatioX?.toFixed(5)) || 1,
            speedRatioY: parseFloat(mappingData.speedRatioY?.toFixed(5)) || 1
        };

        // Create the small eyes node if provided
        // If config.smallEyes exists but enabled is not specified, consider it enabled
        const smallEyesEnabled = mappingData.smallEyes ? 
            (mappingData.smallEyes.enabled === undefined ? true : mappingData.smallEyes.enabled) : 
            false;

        this.mappingData.smallEyes = {
            enabled: smallEyesEnabled,
            type: MAPPING_TYPES.CLICK,
            switchMap: mappingData.smallEyes?.switchMap || false,
            key: mappingData.smallEyes?.key || 'Key_Alt',
            pos: mappingData.smallEyes?.pos || { x: 0.7, y: 0.7 }
        };
        
        this.shape = this.createShape();
        this.shape.smallEyes = null;
        this.shape.connectingLine = null;
        
        if (this.mappingData.smallEyes.enabled) {
            this.createSmallEyesShape();
        }
        
        this.setupEvents();
        this.updateMappingData();  // Initialize mapping data
    }

    createShape() {
        const group = new Konva.Group({
            x: window.scaleManager.denormalizePosition(this.mappingData.startPos).x,
            y: window.scaleManager.denormalizePosition(this.mappingData.startPos).y,
            draggable: false,
            name: 'mainShape'
        });

        // Create draggable container for the main circle and cursor
        const mouseShape = new Konva.Group({
            x: 0,
            y: 0,
            draggable: true,
            name: 'mouseShape'
        });

        // Outer circle container
        const circle = new Konva.Circle({
            radius: 20,
            fill: 'transparent',
            stroke: '#adb5bd',
            strokeWidth: 2,
            opacity: 0.8
        });

        // Mouse icon (simplified design)
        const mouseIcon = new Konva.Path({
            data: 'M7.5.026C4.958.286 3 2.515 3 5.188V5.5h4.5zm1 0V5.5H13v-.312C13 2.515 11.042.286 8.5.026M13 6.5H3v4.313C3 13.658 5.22 16 8 16s5-2.342 5-5.188z',
            fill: '#adb5bd',
            scale: { x: 1.3, y: 1.3 },
            offset: { x: 8, y: 8.5 }
        });


        mouseShape.add(circle);
        mouseShape.add(mouseIcon);
        group.add(mouseShape);

        return group;
    }

    createSmallEyesShape() {
        if (this.shape.smallEyes) {
            this.shape.smallEyes.destroy();
        }
        if (this.shape.connectingLine) {
            this.shape.connectingLine.destroy();
        }

        const pos = window.scaleManager.denormalizePosition(this.mappingData.smallEyes.pos);
        const mouseShape = this.shape.findOne('.mouseShape');
        
        this.shape.smallEyes = new Konva.Group({
            x: pos.x - this.shape.x(),
            y: pos.y - this.shape.y(),
            draggable: true,
            name: 'smallEyes'
        });

        // Eye outer circle (container)
        const eyeContainer = new Konva.Circle({
            radius: 15,
            stroke: '#adb5bd',
            strokeWidth: 2,
            fill: 'transparent',
            opacity: 0.8
        });

        // Eye shape
        const eyeShape = new Konva.Path({
            data: 'M10 0C5.5 0 1.7 3.1 0 7.5 1.7 11.9 5.5 15 10 15s8.3-3.1 10-7.5C18.3 3.1 14.5 0 10 0zM10 12.5c-2.8 0-5-2.2-5-5s2.2-5 5-5 5 2.2 5 5-2.2 5-5 5zm0-8C8.3 4.5 7 5.8 7 7.5s1.3 3 3 3 3-1.3 3-3-1.3-3-3-3z',
            fill: '#adb5bd',
            scale: { x: 1.1, y: 1.1 },
            offset: { x: 10, y: 7.5 }
        });

        // Create key display using KeyDisplayManager
        const keyDisplay = KeyDisplayManager.createKeyShape(
            this.mappingData.smallEyes.key,
            '#adb5bd',
            'transparent',
            2,
            (newKey) => this.setSmallEyesKey(newKey),
            '#fff',
            'transparent',
            1,
            0.8,
            true
        );

        // Position the key display below the eye
        keyDisplay.group.y(28);
        keyDisplay.group.x(-2);

        this.shape.smallEyes.add(eyeContainer);
        this.shape.smallEyes.add(eyeShape);
        this.shape.smallEyes.add(keyDisplay.group);

        // Create connecting line
        this.shape.connectingLine = new Konva.Line({
            points: [
                mouseShape.x(), mouseShape.y(),
                this.shape.smallEyes.x(), this.shape.smallEyes.y()
            ],
            stroke: '#adb5bd',
            strokeWidth: 1,
            dash: [5, 5],
            opacity: 0.5,
            listening: false
        });

        // Add to shape group in correct order
        this.shape.add(this.shape.connectingLine);
        this.shape.add(this.shape.smallEyes);
        this.shape.connectingLine.moveToBottom();

        // Setup events for the newly created small eyes
        this.setupSmallEyesEvents();
    }

    updateShapePosition(shape, dx = 0, dy = 0) {
        const pos = window.scaleManager.normalizePosition(
            shape.x() + this.shape.x() + dx,
            shape.y() + this.shape.y() + dy
        );
        const constrained = window.scaleManager.constrainPosition(pos.x, pos.y);
        const denormalized = window.scaleManager.denormalizePosition(constrained);
        
        shape.x(denormalized.x - this.shape.x());
        shape.y(denormalized.y - this.shape.y());
    }

    setupEvents() {
        // Handle selection
        this.shape.on('select', () => this.updateSelection(true));
        this.shape.on('deselect', () => this.updateSelection(false));

        const mouseShape = this.shape.findOne('.mouseShape');

        // Right-click handler for toggling small eyes
        mouseShape.on('contextmenu', (e) => {
            e.evt.preventDefault(); // Prevent browser context menu
            // Set up small eyes handlers
            const smallEyesEnabled = document.querySelector('#smallEyesEnabled');
            const smallEyesKey = document.querySelector('#smallEyesKey');
            
            smallEyesEnabled.checked = !smallEyesEnabled.checked;
            smallEyesKey.disabled = !smallEyesEnabled.checked;
            this.setSmallEyes({
                enabled: smallEyesEnabled.checked,
                key: smallEyesKey.value
            });
        });

        // Add drag events for mouseShape
        mouseShape.on('dragmove', (e) => {
            const dx = e.evt.movementX;
            const dy = e.evt.movementY;

            this.updateShapePosition(mouseShape);

            // If shift is pressed and small eyes exists, move it proportionally
            if (e.evt.shiftKey && this.shape.smallEyes) {
                this.updateShapePosition(this.shape.smallEyes, dx, dy);
            }
            
            this.updateConnectingLine();
            this.updateMappingData();
        });

        mouseShape.on('dragend', () => {
            this.updateMappingData();
        });

        // Setup small eyes events if they exist
        if (this.shape.smallEyes) {
            this.setupSmallEyesEvents();
        }
    }

    setupSmallEyesEvents() {
        if (!this.shape.smallEyes) return;

        const mouseShape = this.shape.findOne('.mouseShape');

        // Remove existing events if any
        this.shape.smallEyes.off('dragmove');
        this.shape.smallEyes.off('dragend');

        // Add drag events for smallEyes
        this.shape.smallEyes.on('dragmove', (e) => {
            const dx = e.evt.movementX;
            const dy = e.evt.movementY;

            this.updateShapePosition(this.shape.smallEyes);

            // If shift is pressed, move main shape proportionally
            if (e.evt.shiftKey) {
                this.updateShapePosition(mouseShape, dx, dy);
            }
            
            this.updateConnectingLine();
        });

        this.shape.smallEyes.on('dragend', () => {
            this.updateMappingData();
        });
    }

    updateConnectingLine() {
        if (this.shape.connectingLine && this.shape.smallEyes) {
            const mouseShape = this.shape.findOne('.mouseShape');
            this.shape.connectingLine.points([
                mouseShape.x(), mouseShape.y(),
                this.shape.smallEyes.x(), this.shape.smallEyes.y()
            ]);
            this.shape.getLayer().batchDraw();
        }
    }

    updateSelection(selected) {
        if (!this.shape) return;

        const circle = this.shape.findOne('.mouseShape').findOne('Circle');
        if (circle) {
            circle.strokeWidth(selected ? 3 : 2);
            circle.shadowEnabled(selected);
            circle.shadowColor('black');
            circle.shadowBlur(10);
            circle.shadowOpacity(0.5);
            circle.shadowOffset({ x: 2, y: 2 });
        }

        // Update small eyes selection if present
        const smallEyesGroup = this.shape.findOne('.smallEyes');
        if (smallEyesGroup) {
            const smallEyesCircle = smallEyesGroup.findOne('Circle');
            if (smallEyesCircle) {
                smallEyesCircle.strokeWidth(selected ? 3 : 2);
                smallEyesCircle.shadowEnabled(selected);
                smallEyesCircle.shadowColor('black');
                smallEyesCircle.shadowBlur(10);
                smallEyesCircle.shadowOpacity(0.5);
                smallEyesCircle.shadowOffset({ x: 2, y: 2 });
            }
        }
    }

    updateMappingData() {
        if (!this.shape) return;

        const mouseShape = this.shape.findOne('.mouseShape');
        const absolutePos = {
            x: mouseShape.x() + this.shape.x(),
            y: mouseShape.y() + this.shape.y()
        };
        
        const normalizedStartPos = window.scaleManager.normalizePosition(absolutePos.x, absolutePos.y);
        this.mappingData.startPos = {
            x: parseFloat(normalizedStartPos.x.toFixed(3)),
            y: parseFloat(normalizedStartPos.y.toFixed(3))
        };


        if (this.mappingData.smallEyes.enabled) {
            const smallEyesPos = {
                x: this.shape.smallEyes.x() + this.shape.x(),
                y: this.shape.smallEyes.y() + this.shape.y()
            };
            const normalizedSmallEyesPos = window.scaleManager.normalizePosition(smallEyesPos.x, smallEyesPos.y);

            this.mappingData.smallEyes.pos = {
                x: parseFloat(normalizedSmallEyesPos.x.toFixed(3)),
                y: parseFloat(normalizedSmallEyesPos.y.toFixed(3))
            };
        }
    }

    setSpeedRatios(speedRatioX, speedRatioY) {
        this.mappingData.speedRatioX = Math.max(speedRatioX, 0.001);
        this.mappingData.speedRatioY = Math.max(speedRatioY, 0.001);
    }

    setSmallEyes(config) {
        this.mappingData.smallEyes = {
            ...this.mappingData.smallEyes,
            ...config
        };

        // Clean up existing shapes
        if (this.shape.connectingLine) {
            this.shape.connectingLine.destroy();
        }
        if (this.shape.smallEyes) {
            this.shape.smallEyes.destroy();
        }

        // Create new shapes if enabled
        if (this.mappingData.smallEyes.enabled) {
            this.createSmallEyesShape();
        }

        // Draw the layer if it exists
        const layer = this.shape.getLayer();
        if (layer) {
            layer.batchDraw();
        }
    }

    setSmallEyesKey(key) {
        if (this.mappingData.smallEyes.enabled && this.shape.smallEyes) {
            this.mappingData.smallEyes.key = key;
            
            // Update key display
            KeyDisplayManager.updateKeyShape(this.shape.smallEyes, key, true);
            
            // Update mapping data
            this.updateMappingData();

            // Update form input
            const mappingKeyProperties = document.getElementById('smallEyesKey');
            if (mappingKeyProperties) {
                mappingKeyProperties.value = key;
            }
        }
    }
}
