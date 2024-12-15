export class BaseNode {
    constructor(stage, type, mappingData = {}) {
        this.stage = stage;
        this.type = type;
        this.mappingData = {
            comment: mappingData.comment || '',
            ...mappingData,
            type: type,
            opacity: mappingData.opacity || 1
        };
        // Get the stored scale or default to 1
        this.scale = parseFloat(localStorage.getItem('nodeScale') || '1');
    }

    updateMappingData() {
        // Override in child classes
    }
    
    setOpacity(opacity) {
        if (this.shape) {
            this.shape.opacity(opacity);
        }
        this.mappingData.opacity = opacity;
    }

    setKey(key) {
        if (!this.supportsKey()) return;
        
        this.mappingData.key = key;
        if (this.shape && this.shape.getLayer()) {
            this.shape.getLayer().batchDraw();
        }
    }

    get supportsKey() {
        // Override in child classes that support key bindings
        return false;
    }

    storeOriginalValues(shape) {
        if (!shape) return;
        
        const storeForShape = (child) => {
            // Store original values for scaling
            if (child.strokeWidth) {
                child.setAttr('originalStrokeWidth', child.strokeWidth());
            }
            if (child.fontSize) {
                child.setAttr('originalFontSize', child.fontSize());
            }
            if (child.pointerLength) {
                child.setAttr('originalPointerLength', child.pointerLength());
                child.setAttr('originalPointerWidth', child.pointerWidth());
            }
            if (child.radius) {
                child.setAttr('originalRadius', child.radius());
            }
            
            // Recursively store for groups
            if (child instanceof Konva.Group) {
                child.getChildren().forEach(storeForShape);
            }
        };
        
        shape.getChildren().forEach(storeForShape);
    }

    setScale(scale) {
        this.scale = scale;
        if (this.shape) {
            const scaleGroup = (group) => {
                const children = group.getChildren();
                children.forEach(child => {
                    if (child instanceof Konva.Group) {
                        const isSmallEyes = child.hasName('smallEyes');
                        const isClickPoint = child.hasName('clickPoint');
                        
                        // For groups, scale their contents but maintain absolute position
                        const absPos = { x: child.absolutePosition().x, y: child.absolutePosition().y };
                        child.scale({ x: scale, y: scale });
                        child.absolutePosition(absPos);

                        // Find and adjust key display position based on scale
                        if (isSmallEyes || isClickPoint) {
                            const keyDisplay = child.findOne('.keyDisplay');
                            if (keyDisplay) {
                                // For MouseMoveNode's smallEyes
                                if (isSmallEyes) {
                                    // Base position is y:28, x:-2
                                    const baseY = 28;
                                    const adjustedY = baseY * Math.pow(scale, 1.7); // Move further as scale increases
                                    keyDisplay.y(adjustedY);
                                }
                                // For MultiClickNode's clickPoints
                                else if (isClickPoint) {
                                    // Base position is y:-20, x:0
                                    const baseY = -20;
                                    const adjustedY = baseY * Math.pow(scale, 1.7); // Move further as scale increases
                                    keyDisplay.y(adjustedY);
                                }
                            }
                        }
                        
                        scaleGroup(child);
                    } else {
                        // Handle different shape types
                        if (child.getClassName() === 'Arrow' || child.getClassName() === 'Line') {
                            // For arrows and lines, scale using original values with extra emphasis
                            const originalStrokeWidth = child.getAttr('originalStrokeWidth') || child.strokeWidth();
                            // Apply more aggressive scaling to lines to match node scaling
                            const lineScale = scale * scale * scale;  // Cubic scaling for lines
                            child.strokeWidth(originalStrokeWidth * lineScale);
                            
                            // For arrows, scale pointer using original values
                            if (child.getClassName() === 'Arrow') {
                                const originalPointerLength = child.getAttr('originalPointerLength') || child.pointerLength();
                                const originalPointerWidth = child.getAttr('originalPointerWidth') || child.pointerWidth();
                                child.pointerLength(originalPointerLength * lineScale);
                                child.pointerWidth(originalPointerWidth * lineScale);

                                // Scale dash pattern if exists
                                if (child.dash && child.dash().length > 0) {
                                    const originalDash = child.getAttr('originalDash') || child.dash();
                                    if (!child.getAttr('originalDash')) {
                                        child.setAttr('originalDash', [...originalDash]);
                                    }
                                    child.dash(originalDash.map(d => d * scale));
                                }
                            }
                            
                            // If this is a connecting line with point references, update its position
                            if (child.startPoint && child.endPoint) {
                                child.points([
                                    child.startPoint.absolutePosition().x,
                                    child.startPoint.absolutePosition().y,
                                    child.endPoint.absolutePosition().x,
                                    child.endPoint.absolutePosition().y
                                ]);
                            }
                        } else {
                            // For other shapes (circles, text, etc.)
                            child.scale({ x: scale, y: scale });
                            
                            // Scale stroke width using original value
                            if (child.strokeWidth) {
                                const originalStrokeWidth = child.getAttr('originalStrokeWidth') || child.strokeWidth();
                                child.strokeWidth(originalStrokeWidth * scale);
                            }
                            
                            // Scale radius using original value
                            if (child.radius) {
                                const originalRadius = child.getAttr('originalRadius') || child.radius();
                                child.radius(originalRadius * scale);
                            }
                            
                            // Special handling for Path shapes
                            if (child.getClassName() === 'Path') {
                                const pathScale = scale * scale; // More aggressive scaling for paths
                                child.scale({ x: pathScale, y: pathScale });
                            }
                            
                            // Scale font size using original value, but with reduced scaling
                            if (child.getClassName() === 'Text') {
                                const originalFontSize = child.getAttr('originalFontSize') || child.fontSize();
                                // Use square root of scale for text to make it scale more slowly
                                const textScale = Math.pow(scale, 0.2); // Scale text more conservatively
                                child.fontSize(originalFontSize * textScale);
                            }
                        }
                    }
                });
            };

            // Store original values if not already stored
            if (!this.shape.getAttr('valuesStored')) {
                this.storeOriginalValues(this.shape);
                this.shape.setAttr('valuesStored', true);
            }

            // Apply scaling to the main shape group
            scaleGroup(this.shape);
            
            if (this.shape.getLayer()) {
                this.shape.getLayer().batchDraw();
            }
        }
    }

    destroy() {
        if (this.shape) {
            this.shape.destroy();
        }
    }
}