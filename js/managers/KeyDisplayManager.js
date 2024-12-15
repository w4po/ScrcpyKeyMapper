import { getQtKey } from '../utils/qtKeyMapper.js';

export class KeyDisplayManager {
    static keyDisplayMap = {
        'Exclam': '!',
        'At': '@',
        'NumberSign': '#',
        'Dollar': '$',
        'Percent': '%',
        'AsciiCircum': '^',
        'Ampersand': '&',
        'Asterisk': '*',
        'ParenLeft': '(',
        'ParenRight': ')',
        'Underscore': '_',
        'Plus': '+',
        'AsciiTilde': '~',
        'AsciiGrave': '`',
        'Bar': '|',
        'Colon': ':',
        'QuoteDbl': '"',
        'Less': '<',
        'Greater': '>',
        'Question': '?',
        'BracketLeft': '[',
        'BracketRight': ']',
        'Semicolon': ';',
        'Backslash': '\\',
        'Apostrophe': '\'',
        'Quote': "'",
        'QuoteLeft': '`',
        'Comma': ',',
        'Period': '.',
        'Slash': '/',
        'Minus': '-',
        'Equal': '=',
        'Space': '␣',
        'Return': '↵',
        'Up': '↑',
        'Down': '↓',
        'Left': '←',
        'Right': '→',
        'Escape': 'Esc',
        'Control': 'Ctrl',
        'Delete': 'Del',
        'Insert': 'Ins',
        'PageUp': 'PgUp',
        'PageDown': 'PgDn',
        'LeftButton': 'LMB',
        'MiddleButton': 'MMB',
        'RightButton': 'RMB',
        'ExtraButton1': 'MB4',
        'ExtraButton2': 'MB5',
    };

    static activeKeyShape = null;
    static capturingMouseButton = false;
    static textMeasureCanvas = document.createElement('canvas').getContext('2d');

    static getPathData(width, height, cornerRadius) {
        // SVG path for rounded rectangle
        const x = -width / 2;
        const y = -height / 2;
        return `
            M ${x + cornerRadius} ${y}
            L ${x + width - cornerRadius} ${y}
            Q ${x + width} ${y} ${x + width} ${y + cornerRadius}
            L ${x + width} ${y + height - cornerRadius}
            Q ${x + width} ${y + height} ${x + width - cornerRadius} ${y + height}
            L ${x + cornerRadius} ${y + height}
            Q ${x} ${y + height} ${x} ${y + height - cornerRadius}
            L ${x} ${y + cornerRadius}
            Q ${x} ${y} ${x + cornerRadius} ${y}
            Z
        `.trim();
    }

    static getCirclePathData(radius) {
        // SVG path for circle
        return `
            M ${-radius} 0
            A ${radius} ${radius} 0 1 0 ${radius} 0
            A ${radius} ${radius} 0 1 0 ${-radius} 0
            Z
        `.trim();
    }

    static formatKeyText(key) {
        if (!key) return '';
        let displayText = key.replace('Key_', '');
        if (this.keyDisplayMap[displayText]) {
            displayText = this.keyDisplayMap[displayText];
        }
        if (displayText.length > 10) {
            displayText = displayText.substring(0, 8) + '...';
        }
        return displayText;
    }

    static calculateFontSize(text) {
        const MIN_FONT_SIZE = 8;
        const MAX_FONT_SIZE = 11;
        
        // Special case for single characters and special symbols
        if (text.length === 1 || text.match(/^[^a-zA-Z0-9]$/)) {
            return MAX_FONT_SIZE;
        }
        
        // Linear interpolation for font size based on text length
        return Math.max(
            MIN_FONT_SIZE,
            Math.min(
                MAX_FONT_SIZE,
                MAX_FONT_SIZE - ((text.length - 1) * 0.5)
            )
        );
    }

    static getShapeDimensions(text, forceRectangle = false) {
        const baseRadius = 10;
        const fontSize = this.calculateFontSize(text);
        
        // Special case for single characters and special symbols
        if ((text.length === 1 || text.match(/^[^a-zA-Z0-9]$/)) && !forceRectangle) {
            return { 
                type: 'circle', 
                radius: Math.max(baseRadius, text.length * 5),
                fontSize
            };
        }

        // Use canvas for text measurements
        this.textMeasureCanvas.font = `${fontSize}px Arial`;
        const textWidth = this.textMeasureCanvas.measureText(text).width;
        const textHeight = fontSize * 1.2; // Approximate height based on fontSize

        if (text.length <= 8 && !forceRectangle) {
            return { 
                type: 'circle', 
                radius: Math.max(baseRadius, textWidth / 1.7),
                fontSize
            };
        } else {
            const width = textWidth + 10;
            const height = Math.max(baseRadius * 2, textHeight + 8);
            return { 
                type: 'rect', 
                width, 
                height, 
                cornerRadius: height / 2,
                fontSize
            };
        }
    }

    static createKeyShape(key, fillColor = '#666', strokeColor = 'transparent', strokeWidth = 2, onKeyChange = null, textColor = '#fff', textStrokeColor = 'transparent', textStrokeWidth = 1, opacity = 0.8, forceRectangle = false) {
        const displayText = this.formatKeyText(key);
        const shapeDims = this.getShapeDimensions(displayText, forceRectangle);
        const group = new Konva.Group({
            name: 'keyDisplay',
            listening: true,
            perfectDrawEnabled: false,
            shadowForStrokeEnabled: false,
            draggable: false
        });

        // Create shape using Path with optimized settings
        const pathData = shapeDims.type === 'circle' 
            ? this.getCirclePathData(shapeDims.radius)
            : this.getPathData(shapeDims.width, shapeDims.height, shapeDims.cornerRadius);

        const shape = new Konva.Path({
            data: pathData,
            fill: fillColor,
            stroke: strokeColor,
            strokeWidth: strokeWidth,
            opacity: opacity,
            name: 'keyShape',
            perfectDrawEnabled: false,
            shadowForStrokeEnabled: false,
            hitStrokeWidth: 0
        });

        const keyText = new Konva.Text({
            text: displayText,
            fontSize: shapeDims.fontSize,
            fill: textColor,
            stroke: textStrokeColor,
            strokeWidth: textStrokeWidth,
            align: 'center',
            name: 'keyText',
            perfectDrawEnabled: false,
            shadowForStrokeEnabled: false
        });

        // Center the text
        keyText.offsetX(keyText.width() / 2);
        keyText.offsetY(keyText.height() / 2);

        group.add(shape);
        group.add(keyText);

        if (onKeyChange) {
            const handleKeyDown = (e) => {
                e.preventDefault();
                e.stopPropagation();
            };

            const handleMouseDown = (e) => {
                if (!this.activeKeyShape) return;
                
                e.preventDefault();
                e.stopPropagation();
                
                // Set flag to prevent click handler from firing
                this.capturingMouseButton = true;
                
                // Get Qt key code for mouse button
                const qtKey = getQtKey(null, null, e.button);
                
                if (qtKey) {
                    onKeyChange(qtKey);
                }
                
                // Clean up
                this.setKeyBindingActive(group, false);
                this.activeKeyShape = null;
                document.removeEventListener('keydown', handleKeyDown);
                document.removeEventListener('keyup', handleKeyUp);
                document.removeEventListener('mousedown', handleClickOutside);
                document.removeEventListener('mousedown', handleMouseDown);
                
                // Reset flag after a short delay to allow click event to pass
                setTimeout(() => {
                    this.capturingMouseButton = false;
                }, 100);
            };

            const handleKeyUp = (e) => {
                e.preventDefault();
                e.stopPropagation();
                
                // Get Qt key code using the mapper
                const qtKey = getQtKey(e.code, e.key);
                
                if (qtKey) {
                    onKeyChange(qtKey);
                }
                
                // Clean up
                this.setKeyBindingActive(group, false);
                this.activeKeyShape = null;
                document.removeEventListener('keydown', handleKeyDown);
                document.removeEventListener('keyup', handleKeyUp);
                document.removeEventListener('mousedown', handleClickOutside);
                document.removeEventListener('mousedown', handleMouseDown);
            };

            // Add click outside listener
            const handleClickOutside = (e) => {
                const pos = group.getStage().getPointerPosition();
                // Stop listening if clicked anywhere except the active shape
                if (!group.hasName('activeKeyBinding') || 
                    !group.getStage().content.contains(e.target) || 
                    !group.children.some(child => {
                        const rect = child.getClientRect();
                        return pos.x >= rect.x && 
                               pos.x <= rect.x + rect.width && 
                               pos.y >= rect.y && 
                               pos.y <= rect.y + rect.height;
                    })) {
                    this.setKeyBindingActive(group, false);
                    this.activeKeyShape = null;
                    document.removeEventListener('keydown', handleKeyDown);
                    document.removeEventListener('keyup', handleKeyUp);
                    document.removeEventListener('mousedown', handleClickOutside);
                    document.removeEventListener('mousedown', handleMouseDown);
                }
            };

            group.on('dblclick dbltap', (e) => {
                // Accept touch events (dbltap) or left mouse button double clicks
                const isTouchEvent = e.evt.type.includes('touch');
                if (!isTouchEvent && e.evt.button !== 0) return;
                
                e.cancelBubble = true;

                // Skip if we're handling a mouse button
                if (this.capturingMouseButton) {
                    return;
                }

                // If this shape is already active, deactivate it
                if (this.activeKeyShape === group) {
                    this.setKeyBindingActive(group, false);
                    this.activeKeyShape = null;
                    document.removeEventListener('keydown', handleKeyDown);
                    document.removeEventListener('keyup', handleKeyUp);
                    document.removeEventListener('mousedown', handleClickOutside);
                    document.removeEventListener('mousedown', handleMouseDown);
                    return;
                }

                // Deactivate previous shape if exists
                if (this.activeKeyShape) {
                    this.setKeyBindingActive(this.activeKeyShape, false);
                }

                // Activate this shape
                this.activeKeyShape = group;
                group.setName('activeKeyBinding');
                this.setKeyBindingActive(group, true);

                document.addEventListener('keydown', handleKeyDown);
                document.addEventListener('keyup', handleKeyUp);
                document.addEventListener('mousedown', handleMouseDown);
                setTimeout(() => document.addEventListener('mousedown', handleClickOutside), 0);
            });

            // Add hover effect
            group.on('mouseenter', () => {
                if (this.activeKeyShape !== group) {
                    shape.stroke('#999');
                    group.getLayer()?.batchDraw();
                }
            });

            group.on('mouseleave', () => {
                if (this.activeKeyShape !== group) {
                    shape.stroke('transparent');
                    group.getLayer()?.batchDraw();
                }
            });
        }

        return {
            group,
            shape,
            text: keyText,
            dimensions: shapeDims
        };
    }

    static updateKeyShape(keyGroup, newKey, forceRectangle = false) {
        const displayText = this.formatKeyText(newKey);
        const shapeDims = this.getShapeDimensions(displayText, forceRectangle);
        
        const shape = keyGroup.findOne('.keyShape');
        const keyText = keyGroup.findOne('.keyText');
        
        if (!shape || !keyText) return;

        // Update shape path
        const pathData = shapeDims.type === 'circle' 
            ? this.getCirclePathData(shapeDims.radius)
            : this.getPathData(shapeDims.width, shapeDims.height, shapeDims.cornerRadius);
        
        shape.data(pathData);

        // Update text
        keyText.text(displayText);
        keyText.fontSize(shapeDims.fontSize);
        keyText.offsetX(keyText.width() / 2);
        keyText.offsetY(keyText.height() / 2);

        keyGroup.getLayer()?.batchDraw();
    }

    static setKeyBindingActive(keyGroup, active) {
        const shape = keyGroup.findOne('.keyShape');
        if (!shape) return;

        // Always clean up any existing animation first
        if (keyGroup.pulseAnimation) {
            keyGroup.pulseAnimation.stop();
            delete keyGroup.pulseAnimation;
            keyGroup.scale({ x: 1, y: 1 });
        }

        if (active) {
            // Highlight effect
            shape.stroke('#4CAF50');
            shape.strokeWidth(2);
            shape.opacity(1);

            // Add pulsing animation
            const pulseAnimation = new Konva.Animation((frame) => {
                if (!frame) return;
                const scale = 1 + Math.sin(frame.time * 0.005) * 0.03;
                keyGroup.scale({ x: scale, y: scale });
            }, keyGroup.getLayer());

            keyGroup.pulseAnimation = pulseAnimation;
            pulseAnimation.start();
        } else {
            // Remove highlight and name
            shape.stroke('transparent');
            shape.strokeWidth(2);
            shape.opacity(0.8);
            keyGroup.scale({ x: 1, y: 1 });
            keyGroup.name(''); // Clear the activeKeyBinding name
        }

        keyGroup.getLayer()?.batchDraw();
    }
}
