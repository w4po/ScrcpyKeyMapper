import { BaseNode } from './BaseNode.js';
import { KeyDisplayManager } from '../managers/KeyDisplayManager.js';

export class MultiClickNode extends BaseNode {
    constructor(stage, mappingData, dragPos = {x: 0.5, y: 0.5}) {
        super(stage, mappingData.type, mappingData);
        
        this.mappingData = {
            ...mappingData,
            key: mappingData.key || '',
            clickNodes: mappingData.clickNodes || [],
            switchMap: mappingData.switchMap || false
        };

        this.shape = this.createShape();
        
        this.setupEvents();
        this.setClickNodes(dragPos);
    }

    createShape() {
        const group = new Konva.Group({
            draggable: false,
            name: 'mainShape',
            perfectDrawEnabled: false,
            shadowForStrokeEnabled: false
        });

        return group;
    }

    addClickPoint(pos, delay = 200) {
        if (!this.shape) return;
        
        const denormalized = window.scaleManager.denormalizePosition(pos);
        const orderNumber = this.shape.find('.clickPoint').length + 1;
        
        // Create the click point group
        const point = new Konva.Group({
            x: denormalized.x,
            y: denormalized.y,
            draggable: true,
            name: 'clickPoint',
            perfectDrawEnabled: false,
            shadowForStrokeEnabled: false
        });

        // Create the main circle
        const circle = new Konva.Circle({
            radius: 8,
            fill: '#dc3545',
            stroke: '#bd2130',
            strokeWidth: 2,
            perfectDrawEnabled: false,
            shadowForStrokeEnabled: false
        });

        // Add order number
        const orderText = new Konva.Text({
            text: orderNumber.toString(),
            fontSize: 10,
            fill: 'white',
            align: 'center',
            verticalAlign: 'middle',
            x: -4,
            y: -6,
            name: 'orderNumber',
            listening: false,
            perfectDrawEnabled: false
        });

        // Create delay text
        const delayText = new Konva.Text({
            text: delay + 'ms',
            fontSize: 12,
            fill: '#dc3545',
            offsetX: 20,
            offsetY: -10,
            name: 'delayText',
            perfectDrawEnabled: false
        });

        // Create delete button
        const deleteBtn = new Konva.Group({
            x: -20,
            y: -20,
            opacity: 0,
            name: 'deleteBtn',
            perfectDrawEnabled: false
        });

        const deleteBg = new Konva.Circle({
            radius: 8,
            fill: '#dc3545',
            stroke: '#bd2130',
            strokeWidth: 1,
            perfectDrawEnabled: false
        });

        const deleteX = new Konva.Text({
            text: '×',
            fontSize: 12,
            fill: 'white',
            align: 'center',
            verticalAlign: 'middle',
            offsetX: 4,
            offsetY: 6,
            perfectDrawEnabled: false
        });

        deleteBtn.add(deleteBg);
        deleteBtn.add(deleteX);

        // Add key display for first node only
        if (orderNumber === 1) {
            const keyDisplay = KeyDisplayManager.createKeyShape(
                this.mappingData.key,
                '#dc3545',
                'transparent',
                2,
                (newKey) => this.setKey(newKey),
                '#fff',
                'transparent',
                1,
                0.8,
                this.mappingData.key
            );

            // Position the key display below the circle
            keyDisplay.group.y(-20);
            keyDisplay.group.x(0);
            point.add(keyDisplay.group);
        }

        // Add all elements to the point group
        point.add(circle);
        point.add(orderText);
        point.add(delayText);
        point.add(deleteBtn);

        // Store click node data
        point.clickData = {
            delay,
            pos,
            order: orderNumber
        };

        this.setupPointEvents(point);
        this.shape.add(point);

        // Add connecting line to previous point if not first point
        if (orderNumber > 1) {
            const prevPoint = this.shape.find('.clickPoint')[orderNumber - 2];
            this.createConnectingLine(prevPoint, point);
        }

        // Update mapping data
        this.mappingData.clickNodes.push({
            delay,
            pos,
            order: orderNumber
        });

        this.updateMappingData();

        return point;
    }

    createConnectingLine(startPoint, endPoint) {
        const line = new Konva.Arrow({
            points: [
                startPoint.x(),
                startPoint.y(),
                endPoint.x(),
                endPoint.y()
            ],
            stroke: '#dc3545',
            strokeWidth: 2,
            dash: [5, 5],
            pointerLength: 5,
            pointerWidth: 5,
            name: 'connectingLine',
            perfectDrawEnabled: false,
            shadowForStrokeEnabled: false,
            listening: false
        });

        // Store references to connected points
        line.startPoint = startPoint;
        line.endPoint = endPoint;
        
        this.shape.add(line);
        line.moveToBottom();
        return line;
    }

    updateLinePosition(point) {
        // Find lines connected to this point
        const lines = this.shape.find('.connectingLine').filter(line => 
            line.startPoint === point || line.endPoint === point
        );

        // Update line positions
        lines.forEach(line => {
            const points = line.points();
            if (line.startPoint === point) {
                points[0] = point.x();
                points[1] = point.y();
            }
            if (line.endPoint === point) {
                points[2] = point.x();
                points[3] = point.y();
            }
            line.points(points);
        });
    }

    updateNodeNumbers() {
        const points = this.shape.find('.clickPoint');
        points.forEach((point, index) => {
            point.clickData.order = index + 1;
            const orderText = point.findOne('.orderNumber');
            if (orderText) {
                orderText.text((index + 1).toString());
                orderText.fill('white');
            }
        });

        // Update mapping data order numbers
        this.mappingData.clickNodes = this.mappingData.clickNodes.map((node, index) => ({
            ...node,
            order: index + 1
        }));
    }

    updatePointPosition(point, dx = 0, dy = 0) {
        if (!this.shape) return;
        
        const newX = point.x() + dx;
        const newY = point.y() + dy;
        const pos = window.scaleManager.normalizePosition(newX, newY);
        const constrained = window.scaleManager.constrainPosition(pos.x, pos.y);
        const denormalized = window.scaleManager.denormalizePosition(constrained);
        
        point.x(denormalized.x);
        point.y(denormalized.y);
        
        // Update only connected lines
        this.updateLinePosition(point);
        
        // Update mapping data
        point.clickData.pos = constrained; // Store normalized position
    }

    moveAllPoints(sourcePoint, dx, dy) {
        if (!this.shape) return;
        
        const points = this.shape.find('.clickPoint');
        points.forEach(point => {
            if (point !== sourcePoint) {
                this.updatePointPosition(point, dx, dy);
            }
        });
    }

    setupPointEvents(point) {
        const deleteBtn = point.findOne('.deleteBtn');

        // Show/hide delete button on hover
        point.on('mouseover', () => {
            if (deleteBtn && this.shape) {
                deleteBtn.opacity(1);
                this.shape.getLayer()?.batchDraw();
            }
        });

        point.on('mouseout', () => {
            if (deleteBtn && this.shape) {
                deleteBtn.opacity(0);
                this.shape.getLayer()?.batchDraw();
            }
        });

        // Handle delete button click
        deleteBtn.on('click tap', () => {
            this.deletePoint(point);
        });

        // Handle dragging
        point.on('dragmove', (e) => {
            if (!this.shape) return;
            
            const dx = e.evt.movementX;
            const dy = e.evt.movementY;
            
            // Update the dragged point
            this.updatePointPosition(point);
            
            // If shift is pressed, move all other points
            if (e.evt.shiftKey) {
                this.moveAllPoints(point, dx, dy);
            }
            
            this.updateMappingData();
        });

        point.on('dragend', () => {
            if (!this.shape) return;
            this.updateMappingData();
        });

        // Handle selection
        point.on('mousedown touchstart', (e) => {
            if (!this.shape) return;
            // Prevent event from firing when clicking delete button
            if (e.target.parent?.name() !== 'deleteBtn') {
                this.shape.fire('select');
            }
        });

        // Handle delay adjustment
        point.on('dblclick', () => {
            if (!this.shape || !this.shape.hasName('selected')) return;
            
            const currentDelay = point.clickData.delay;
            const newDelay = prompt('Enter new delay (ms):', currentDelay);
            
            if (newDelay !== null && !isNaN(newDelay)) {
                point.clickData.delay = parseInt(newDelay, 10);
                // Find the delay text by checking all text elements
                const texts = point.find('Text');
                const delayText = texts.find(text => text.text().endsWith('ms'));
                if (delayText) {
                    delayText.text(newDelay + 'ms');
                }
                this.updateMappingData();
                this.shape.getLayer()?.batchDraw();
            }
        });
    }

    deletePoint(point) {
        const points = this.shape.find('.clickPoint');
        const index = points.indexOf(point);
        
        if (index === 0) {
            // If it's the first node, delete the entire node
            window.nodeManager.deleteSelectedNode();
        } else if (points.length > 1) {
            // Find and handle connected lines
            const connectedLines = this.shape.find('.connectingLine').filter(line => 
                line.startPoint === point || line.endPoint === point
            );

            if (index < points.length - 1) {
                // If not the last point, connect previous and next points
                const prevPoint = points[index - 1];
                const nextPoint = points[index + 1];
                this.createConnectingLine(prevPoint, nextPoint);
            }

            // Remove connected lines
            connectedLines.forEach(line => line.destroy());

            // Remove from mapping data
            this.mappingData.clickNodes.splice(index, 1);
            point.destroy();
            
            this.updateNodeNumbers();
            this.updateMappingData();
            if (this.shape) {
                this.shape.getLayer()?.batchDraw();
            }
        }
    }

    setupEvents() {
        // Handle selection for the entire group
        this.shape.on('select', () => this.updateSelection(true));
        this.shape.on('deselect', () => this.updateSelection(false));

        // Right-click on stage to add new point
        const contextMenuHandler = (e) => {
            if (this.shape && this.shape.hasName('selected')) {
                e.evt.preventDefault();
                const pos = window.scaleManager.normalizePosition(
                    e.target.getStage().getPointerPosition().x,
                    e.target.getStage().getPointerPosition().y
                );

                let point = this.addClickPoint(pos, 150);
                this.shape.getLayer()?.batchDraw();
                
                if (point && point.getStage()) {
                    point.startDrag();
                }
            }
        };

        this.stage.on('contextmenu', contextMenuHandler);
        
        // Store the handler for cleanup
        this.contextMenuHandler = contextMenuHandler;
    }

    updateSelection(selected) {
        if (!this.shape) return;
        
        this.shape.setName(selected ? 'mainShape selected' : 'mainShape');
        
        const points = this.shape.find('.clickPoint');
        points.forEach(point => {
            if (!point) return;
            
            const circle = point.findOne('Circle');
            if (!circle) return;
            
            circle.strokeWidth(selected ? 3 : 2);
            circle.shadowEnabled(selected);
            circle.shadowColor('black');
            circle.shadowBlur(10);
            circle.shadowOpacity(0.5);
            circle.shadowOffset({ x: 2, y: 2 });

            // Find texts by their content pattern
            const texts = point.find('Text');
            texts.forEach(text => {
                if (!text) return;
                if (text.text().endsWith('ms')) {
                    // This is the delay text
                    text.fill(selected ? '#a71d2a' : '#dc3545');
                } else {
                    // This is the order number
                    text.fill('white');
                }
            });
        });

        // Update connecting lines
        if (this.shape) {
            this.shape.find('.connectingLine').forEach(line => {
                if (!line) return;
                line.strokeWidth(selected ? 2 : 1);
            });
        }
    }

    constrainPosition(x, y) {
        const padding = 0.002;
        return {
            x: Math.min(Math.max(x, padding), 1 - padding),
            y: Math.min(Math.max(y, padding), 1 - padding)
        };
    }

    updateMappingData() {
        const points = this.shape.find('.clickPoint');
        this.mappingData.clickNodes = points.map(point => ({
            delay: point.clickData.delay,
            pos: point.clickData.pos,
            order: point.clickData.order
        }));
    }

    setClickNodes(dragPos = {x: 0.5, y: 0.5}) {
        if (this.mappingData.clickNodes.length == 0) {
            this.addClickPoint(dragPos, 0);
            return;
        }

        // Clear existing nodes and lines
        this.shape.find('.clickPoint, .connectingLine').forEach(node => node.destroy());

        // Add new nodes from mapping data
        this.mappingData.clickNodes.forEach(node => {
            this.addClickPoint(node.pos, node.delay);
        });

        this.updateMappingData();
        this.shape.getLayer()?.batchDraw();
    }

    setKey(key) {
        this.mappingData.key = key;
        
        // Update key display on first node
        const points = this.shape.find('.clickPoint');
        if (points.length > 0) {
            const firstNode = points[0];
            KeyDisplayManager.updateKeyShape(firstNode, key, true);
        }
        
        // Update form input
        const mappingKeyProperties = document.getElementById('mappingKeyProperties');
        if (mappingKeyProperties) {
            mappingKeyProperties.value = key;
        }
    }

    get supportsKey() {
        return true;
    }

    destroy() {
        if (!this.shape) return;

        // Remove contextmenu event listener from stage
        if (this.contextMenuHandler) {
            this.stage.off('contextmenu', this.contextMenuHandler);
        }

        // Clear all nodes
        const points = this.shape.find('.clickPoint');
        points.forEach(point => {
            if (point) point.destroy();
        });

        // Clear shape
        if (this.shape) {
        const layer = this.shape.getLayer();
            this.shape.destroy();
            this.shape = null;
            if (layer) {
                const nodeManager = this.stage.nodeManager;
                if (nodeManager) {
                    const nodeIndex = nodeManager.nodes.findIndex(m => m.shape === this.shape);
                    if (nodeIndex !== -1) {
                        nodeManager.nodes.splice(nodeIndex, 1);
                    }
                    // Deselect if this was selected
                    if (nodeManager.selectedNode?.shape === this.shape) {
                        nodeManager.deselectNode();
                    }
                }
                layer.batchDraw();
            }
        }
    }
}
