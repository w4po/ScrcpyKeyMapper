import { BaseNode } from './BaseNode.js';
import { KeyDisplayManager } from '../managers/KeyDisplayManager.js';

export class DragNode extends BaseNode {
    constructor(stage, mappingData) {
        super(stage, mappingData.type, mappingData);
        
        this.mappingData = {
            ...mappingData,
            startPos: mappingData.startPos || { x: 0.5, y: 0.5 },
            endPos: mappingData.endPos || { x: mappingData.startPos.x + 0.02, y: mappingData.startPos.y + 0.07 },
            key: mappingData.key || '',
            startDelay: mappingData.startDelay || 0,
            dragSpeed: mappingData.dragSpeed || 1,
            switchMap: mappingData.switchMap || false
        };
        this.shape = this.createShape();
        
        // Set initial arrow rotation
        this.updateArrowRotation();

        this.setupEvents();
    }

    createShape() {
        const denormalizedStart = window.scaleManager.denormalizePosition(this.mappingData.startPos);
        const denormalizedEnd = window.scaleManager.denormalizePosition(this.mappingData.endPos);

        const group = new Konva.Group({
            x: 0,
            y: 0,
            draggable: false,
            name: 'mainShape'
        });
        
        // Create connecting line first (so it's under everything)
        group.line = new Konva.Line({
            points: [
                denormalizedStart.x,
                denormalizedStart.y,
                denormalizedEnd.x,
                denormalizedEnd.y
            ],
            draggable: true,
            stroke: '#666',
            strokeWidth: 17,
            opacity: 0.1,
            name: 'connectionLine'
        });

        // Create start point with key shape
        const startGroup = new Konva.Group({
            x: denormalizedStart.x,
            y: denormalizedStart.y,
            draggable: true,
            name: 'startPoint'
        });

        // Create the key shape using KeyDisplayManager with key change callback
        const keyDisplay = KeyDisplayManager.createKeyShape(
            this.mappingData.key, 
            '#666', 
            'transparent', 
            2, 
            (newKey) => this.setKey(newKey)
        );
        startGroup.add(keyDisplay.group);

        // Create end point with filled circle and arrow
        const endGroup = new Konva.Group({
            x: denormalizedEnd.x,
            y: denormalizedEnd.y,
            draggable: true,
            name: 'endPoint'
        });

        const endCircle = new Konva.Circle({
            radius: 9,
            fill: '#fff',
            strokeWidth: 1,
            opacity: 0.8
        });

        const arrowIcon = new Konva.Path({
            data: 'M8 0a8 8 0 1 1 0 16A8 8 0 0 1 8 0M4.5 7.5a.5.5 0 0 0 0 1h5.793l-2.147 2.146a.5.5 0 0 0 .708.708l3-3a.5.5 0 0 0 0-.708l-3-3a.5.5 0 1 0-.708.708L10.293 7.5z',
            fill: '#dc3545',
            scale: { x: 1.0, y: 1.0 },
            offset: { x: 8, y: 8 }
        });

        endGroup.add(endCircle);
        endGroup.add(arrowIcon);

        // Store references for updating positions
        group.startPoint = startGroup;
        group.endPoint = endGroup;

        // Add elements in the correct order (line at bottom, start point, then end point)
        group.add(group.line);
        group.add(startGroup);
        group.add(endGroup);

        return group;
    }

    setupEvents() {
        this.addDragHandlers();
        this.setupSelectionHandlers();
        this.updateMappingData();
    }

    updateArrowRotation() {
        const dx = this.shape.endPoint.x() - this.shape.startPoint.x();
        const dy = this.shape.endPoint.y() - this.shape.startPoint.y();
        const angle = Math.atan2(dy, dx) * 180 / Math.PI;
        
        // Get the arrow icon (second child of endGroup)
        const arrowIcon = this.shape.endPoint.findOne('Path');
        if (arrowIcon) {
            arrowIcon.rotation(angle);
        }
    }

    updateArrow() {
        this.shape.line.points([
            this.shape.startPoint.x(),
            this.shape.startPoint.y(),
            this.shape.endPoint.x(),
            this.shape.endPoint.y()
        ]);
        this.updateArrowRotation();
    }

    updatePointPosition(point, dx = 0, dy = 0) {
        const pos = window.scaleManager.normalizePosition(
            point.x() + dx,
            point.y() + dy
        );
        const constrained = window.scaleManager.constrainPosition(pos.x, pos.y);
        const denormalized = window.scaleManager.denormalizePosition(constrained);
        
        point.x(denormalized.x);
        point.y(denormalized.y);
    }

    addDragHandlers() {
        this.shape.line.on('dragmove', (e) => {
            const dx = e.evt.movementX;
            const dy = e.evt.movementY;
            
            // Update both points
            this.updatePointPosition(this.shape.startPoint, dx, dy);
            this.updatePointPosition(this.shape.endPoint, dx, dy);
            
            // Reset line position
            e.target.x(0);
            e.target.y(0);
            
            this.updateArrow();
        });

        this.shape.line.on('dragend', () => {
            this.updateMappingData();
        });

        // Start point drag
        this.shape.startPoint.on('dragmove', (e) => {
            this.updatePointPosition(this.shape.startPoint);
            
            // If shift is pressed, move end point proportionally
            if (e.evt.shiftKey) {
                const dx = e.evt.movementX;
                const dy = e.evt.movementY;
                this.updatePointPosition(this.shape.endPoint, dx, dy);
            }
            
            this.updateArrow();
        });

        // End point drag
        this.shape.endPoint.on('dragmove', (e) => {
            this.updatePointPosition(this.shape.endPoint);
            
            // If shift is pressed, move start point proportionally
            if (e.evt.shiftKey) {
                const dx = e.evt.movementX;
                const dy = e.evt.movementY;
                this.updatePointPosition(this.shape.startPoint, dx, dy);
            }
            
            this.updateArrow();
        });

        this.shape.startPoint.on('dragend', () => {
            this.updateMappingData();
        });

        this.shape.endPoint.on('dragend', () => {
            this.updateMappingData();
        });
    }

    setupSelectionHandlers() {
        const makeSelectable = (element) => {
            element.on('mousedown touchstart', () => {
                this.shape.fire('select');
            });
        };

        makeSelectable(this.shape.startPoint);
        makeSelectable(this.shape.endPoint);
        makeSelectable(this.shape.line);

        this.shape.on('select', () => this.updateSelection(true));
        this.shape.on('deselect', () => this.updateSelection(false));
    }

    updateSelection(selected) {
        // Circle (Start point)
        const startShape = this.shape.startPoint.findOne('Path');
        startShape.stroke('#666');
        startShape.strokeWidth(selected ? 2 : 1);
        startShape.opacity(selected ? 1 : 0.8);

        // Arrow (End point)
        const endShape = this.shape.endPoint.findOne('Circle');
        endShape.stroke('#ddd');
        endShape.strokeWidth(selected ? 2 : 1);
        endShape.opacity(selected ? 1 : 0.8);

        // Line
        this.shape.line.strokeWidth(selected ? 20 : 17);
        this.shape.line.opacity(selected ? 0.8 : 0.1);
    }

    updateMappingData() {
        this.mappingData.startPos = window.scaleManager.normalizePosition(this.shape.startPoint.x(), this.shape.startPoint.y()),
        this.mappingData.endPos = window.scaleManager.normalizePosition(this.shape.endPoint.x(), this.shape.endPoint.y())
    }

    get supportsKey() {
        return true;
    }

    setKey(key) {
        this.mappingData.key = key;

        // Update the key shape
        const startGroup = this.shape.startPoint;
        if (startGroup) {
            KeyDisplayManager.updateKeyShape(startGroup, key);
        }

        // Update form input if it exists
        const mappingKeyProperties = document.getElementById('mappingKeyProperties');
        if (mappingKeyProperties) {
            mappingKeyProperties.value = key;
        }
    }

    setStartDelay(delay) {
        this.mappingData.startDelay = Math.min(2000, Math.max(0, delay));
    }

    setDragSpeed(speed) {
        this.mappingData.dragSpeed = Math.min(1, Math.max(0, speed));
    }
}
