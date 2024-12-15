import { BaseNode } from './BaseNode.js';
import { KeyDisplayManager } from '../managers/KeyDisplayManager.js';

export class SteerWheelNode extends BaseNode {
    constructor(stage, mappingData) {
        super(stage, mappingData.type, mappingData);
        
        this.mappingData = {
            ...mappingData,
            centerPos: mappingData.centerPos || { x: 0.5, y: 0.5 },
            leftOffset: parseFloat(mappingData.leftOffset?.toFixed(5)) || parseFloat(this.calculateDefaultOffset('left').toFixed(5)),
            rightOffset: parseFloat(mappingData.rightOffset?.toFixed(5)) || parseFloat(this.calculateDefaultOffset('right').toFixed(5)),
            upOffset: parseFloat(mappingData.upOffset?.toFixed(5)) || parseFloat(this.calculateDefaultOffset('up').toFixed(5)),
            downOffset: parseFloat(mappingData.downOffset?.toFixed(5)) || parseFloat(this.calculateDefaultOffset('down').toFixed(5)),
            leftKey: mappingData.leftKey || 'Key_A',
            rightKey: mappingData.rightKey || 'Key_D',
            upKey: mappingData.upKey || 'Key_W',
            downKey: mappingData.downKey || 'Key_S',
            switchMap: mappingData.switchMap || false
        };

        // Constants
        this.MIN_PIXEL_DISTANCE = 20;

        this.shape = this.createShape();
        this.setupEvents();
        this.updateMappingData();
    }

    createShape() {
        const denormalized = window.scaleManager.denormalizePosition(this.mappingData.centerPos);
        const group = new Konva.Group({
            x: denormalized.x,
            y: denormalized.y,
            draggable: true,
            name: 'mainShape'
        });

        // Create the wheel shape
        group.wheel = new Konva.Circle({
            x: 0,
            y: 0,
            radius: 15,
            fill: '#17a2b8',
            stroke: '#138496',
            strokeWidth: 2,
            name: 'wheel'
        });

        // Add center wheel first (will be at bottom)
        group.add(group.wheel);

        // Create directional buttons with labels
        const directions = [
            { key: 'up', angle: -Math.PI/2, label: 'W' },
            { key: 'right', angle: 0, label: 'D' },
            { key: 'down', angle: Math.PI/2, label: 'S' },
            { key: 'left', angle: Math.PI, label: 'A' }
        ];

        group.directionButtons = {};
        group.connectingLines = {};
        
        // Create and add connecting lines first (will be below buttons)
        directions.forEach(dir => {
            const offset = this.mappingData[`${dir.key}Offset`];
            const distance = this.offsetToPixels(offset, dir.key);
            const x = Math.cos(dir.angle) * distance;
            const y = Math.sin(dir.angle) * distance;

            const line = new Konva.Line({
                points: [0, 0, x, y],
                stroke: '#138496',
                strokeWidth: 2,
                name: `${dir.key}Line`
            });
            group.connectingLines[dir.key] = line;
            group.add(line);
        });
        
        // Then create and add direction buttons (will be on top)
        directions.forEach(dir => {
            const offset = this.mappingData[`${dir.key}Offset`];
            const distance = this.offsetToPixels(offset, dir.key);
            const x = Math.cos(dir.angle) * distance;
            const y = Math.sin(dir.angle) * distance;
            
            // Button group
            const buttonGroup = new Konva.Group({
                x: x,
                y: y,
                name: `${dir.key}Button`,
                draggable: true
            });

            // Create key display using KeyDisplayManager
            const keyDisplay = KeyDisplayManager.createKeyShape(
                this.mappingData[`${dir.key}Key`],
                '#17a2b8',
                'transparent',
                2,
                (newKey) => this.setDirectionKey(dir.key, newKey)
            );

            buttonGroup.add(keyDisplay.group);
            
            group.directionButtons[dir.key] = {
                group: buttonGroup,
                keyDisplay,
                angle: dir.angle
            };
            
            // Setup drag events for the button
            buttonGroup.on('dragmove', () => {
                const dx = buttonGroup.x();
                const dy = buttonGroup.y();
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                // Constrain the button to move along its angle
                const minDistance = this.MIN_PIXEL_DISTANCE;
                const maxDistance = this.offsetToPixels(this.calculateMaxOffset(dir.key), dir.key);
                const constrainedDistance = Math.min(Math.max(distance, minDistance), maxDistance);
                
                const newX = Math.cos(dir.angle) * constrainedDistance;
                const newY = Math.sin(dir.angle) * constrainedDistance;
                
                buttonGroup.position({
                    x: newX,
                    y: newY
                });

                // Update the offset based on the distance (normalized to 0-1 range)
                const newOffset = this.calculateConstrainedOffset(constrainedDistance, dir.key);
                this.mappingData[`${dir.key}Offset`] = parseFloat(newOffset.toFixed(5));
                
                this.updateMappingData();
                this.updateConnectingLine(dir.key);
            });

            group.add(buttonGroup);
        });

        return group;
    }

    updateConnectingLine(direction) {
        const buttonData = this.shape.directionButtons[direction];
        const line = this.shape.connectingLines[direction];
        if (buttonData?.group && line) {
            line.points([0, 0, buttonData.group.x(), buttonData.group.y()]);
            this.shape.getLayer()?.batchDraw();
        }
    }

    setupEvents() {
        // Setup drag events for the main wheel
        this.shape.on('dragmove', () => {
            const pos = window.scaleManager.normalizePosition(this.shape.x(), this.shape.y());
            const constrained = window.scaleManager.constrainPosition(pos.x, pos.y);
            const denormalized = window.scaleManager.denormalizePosition(constrained);
            this.shape.x(denormalized.x);
            this.shape.y(denormalized.y);
            
            // Update offsets when center position changes
            Object.entries(this.shape.directionButtons).forEach(([direction, elements]) => {
                const currentOffset = this.mappingData[`${direction}Offset`];
                const maxOffset = this.calculateMaxOffset(direction);
                if (currentOffset > maxOffset) {
                    this.mappingData[`${direction}Offset`] = parseFloat(maxOffset.toFixed(5));
                    const distance = this.offsetToPixels(maxOffset, direction);
                    const x = Math.cos(elements.angle) * distance;
                    const y = Math.sin(elements.angle) * distance;
                    elements.group.position({ x, y });
                    this.updateConnectingLine(direction);
                }
            });
            
            this.updateMappingData();
        });

        // Setup drag events for direction buttons
        Object.entries(this.shape.directionButtons).forEach(([direction, elements]) => {
            elements.group.on('dragmove', () => {
                const dx = elements.group.x();
                const dy = elements.group.y();
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                // Constrain the button to move along its angle
                const minDistance = this.MIN_PIXEL_DISTANCE;
                const maxDistance = this.offsetToPixels(this.calculateMaxOffset(direction), direction);
                const constrainedDistance = Math.min(Math.max(distance, minDistance), maxDistance);
                
                const newX = Math.cos(elements.angle) * constrainedDistance;
                const newY = Math.sin(elements.angle) * constrainedDistance;
                
                elements.group.position({
                    x: newX,
                    y: newY
                });

                // Update the offset based on the distance (normalized to 0-1 range)
                const newOffset = this.calculateConstrainedOffset(constrainedDistance, direction);
                this.mappingData[`${direction}Offset`] = parseFloat(newOffset.toFixed(5));
                
                this.updateMappingData();
                this.updateConnectingLine(direction);
            });
        });

        // Handle selection
        this.shape.on('mousedown touchstart', () => {
            this.shape.fire('select');
        });

        this.shape.on('select', () => this.updateSelection(true));
        this.shape.on('deselect', () => this.updateSelection(false));

        // Add hover effects
        Object.values(this.shape.directionButtons).forEach(elements => {
            elements.group.on('mouseover', () => {
                const keyShape = elements.keyDisplay.group.findOne('.keyShape');
                if (keyShape) {
                    keyShape.fill('#1d96aa');
                    this.shape.getLayer()?.batchDraw();
                }
            });

            elements.group.on('mouseout', () => {
                const keyShape = elements.keyDisplay.group.findOne('.keyShape');
                if (keyShape) {
                    keyShape.fill('#17a2b8');
                    this.shape.getLayer()?.batchDraw();
                }
            });
        });
    }

    setDirectionKey(direction, key, draw = true) {
        this.mappingData[`${direction}Key`] = key;

        if (this.shape.directionButtons[direction]) {
            this.mappingData[`${direction}Key`] = key;
            
            // Update key display
            const buttonData = this.shape.directionButtons[direction];
            KeyDisplayManager.updateKeyShape(buttonData.keyDisplay.group, key);
            
            if (draw)
                this.shape.getLayer()?.batchDraw();

            // Update form input based on direction
            const directionInput = document.querySelector(`[data-direction="${direction}"]`);
            if (directionInput) {
                directionInput.value = key;
            }
        }
    }

    updateSelection(selected) {
        const strokeWidth = selected ? 3 : 2;
        this.shape.wheel.strokeWidth(strokeWidth);
        
        Object.values(this.shape.directionButtons).forEach(elements => {
            const keyShape = elements.keyDisplay.group.findOne('.keyShape');
            if (keyShape) {
                keyShape.strokeWidth(strokeWidth);
                keyShape.shadowEnabled(selected);
                keyShape.shadowColor('black');
                keyShape.shadowBlur(10);
                keyShape.shadowOpacity(0.5);
                keyShape.shadowOffset({ x: 2, y: 2 });
            }
        });

        Object.values(this.shape.connectingLines).forEach(line => {
            line.strokeWidth(strokeWidth);
        });
        
        if (selected) {
            this.shape.wheel.shadowEnabled(true);
            this.shape.wheel.shadowColor('black');
            this.shape.wheel.shadowBlur(10);
            this.shape.wheel.shadowOpacity(0.5);
            this.shape.wheel.shadowOffset({ x: 2, y: 2 });
        } else {
            this.shape.wheel.shadowEnabled(false);
        }
    }

    updateMappingData() {
        if (!this.shape) return;

        const centerPos = window.scaleManager.normalizePosition(this.shape.x(), this.shape.y());
        this.mappingData.centerPos = {x: parseFloat(centerPos.x.toFixed(5)), y: parseFloat(centerPos.y.toFixed(5))};
    }
    
    calculateMaxOffset(direction) {
        const centerPos = window.scaleManager.normalizePosition(this.shape.x(), this.shape.y());
        
        switch(direction) {
            case 'left':
                return centerPos.x; // Can go left up to the current x position
            case 'right':
                return 1 - centerPos.x; // Can go right up to the remaining space
            case 'up':
                return centerPos.y; // Can go up up to the current y position
            case 'down':
                return 1 - centerPos.y; // Can go down up to the remaining space
            default:
                return 0.5;
        }
    }

    offsetToPixels(offset, direction) {
        const background = this.stage.findOne('.background');
        // Use height for up/down, width for left/right
        if (direction === 'up' || direction === 'down') {
            return offset * (background ? background.height() : this.stage.height());
        }
        return offset * (background ? background.width() : this.stage.width());
    }

    pixelsToOffset(pixels, direction) {
        const background = this.stage.findOne('.background');
        // Use height for up/down, width for left/right
        if (direction === 'up' || direction === 'down') {
            return pixels / (background ? background.height() : this.stage.height());
        }
        return pixels / (background ? background.width() : this.stage.width());
    }

    calculateConstrainedOffset(pixelDistance, direction) {
        const normalizedOffset = this.pixelsToOffset(pixelDistance, direction);
        const maxOffset = this.calculateMaxOffset(direction);
        return Math.min(normalizedOffset, maxOffset);
    }

    calculateDefaultOffset(direction) {
        const DEFAULT_PIXEL_DISTANCE = 50; // Desired distance in pixels
        const background = this.stage.findOne('.background');
        const stageWidth = background ? background.width() : this.stage.width();
        const stageHeight = background ? background.height() : this.stage.height();

        // For horizontal directions (left/right), divide by width
        // For vertical directions (up/down), divide by height
        return direction === 'left' || direction === 'right' 
            ? DEFAULT_PIXEL_DISTANCE / stageWidth
            : DEFAULT_PIXEL_DISTANCE / stageHeight;
    }
}
