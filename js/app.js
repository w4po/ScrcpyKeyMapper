import { ScaleManager } from './managers/ScaleManager.js';
import { KeyInputManager } from './managers/KeyInputManager.js';
import { ConfigManager } from './managers/ConfigManager.js';
import { NodeManager } from './managers/NodeManager.js';
import { ThemeManager } from './managers/ThemeManager.js';
import { MAPPING_TYPES } from './utils/constants.js';

class App {
    constructor() {
        this.initializeStage();
        this.initializeManagers();
        this.setupDragAndDrop();
        this.setupEventListeners();
        this.setupBackgroundHandling();
    }

    initializeStage() {
        const container = document.getElementById('mappingCanvas');
        const containerRect = container.getBoundingClientRect();

        // Ensure minimum dimensions
        const width = Math.max(containerRect.width, 300);
        const height = Math.max(containerRect.height, 300);

        this.stage = new Konva.Stage({
            container: 'mappingCanvas',
            width: width,
            height: height
        });

        this.layer = new Konva.Layer();
        this.stage.add(this.layer);

        // Disable context menu on the entire canvas
        this.stage.container().addEventListener('contextmenu', (e) => {
            e.preventDefault();
        });
    }

    initializeManagers() {
        window.nodeManager = this.nodeManager = new NodeManager(this.stage, this.layer);
        window.keyInputManager = this.keyInputManager = new KeyInputManager();
        window.configManager = this.configManager = new ConfigManager(this.nodeManager);
        window.scaleManager = this.scaleManager = new ScaleManager(this.stage, this.layer);
        window.themeManager = this.themeManager = new ThemeManager();
    }

    setupDragAndDrop() {
        const container = this.stage.container();

        // Add visual feedback for drag over
        container.addEventListener('dragenter', (e) => {
            e.preventDefault();
            container.parentElement.classList.add('drag-over');
        });

        container.addEventListener('dragleave', (e) => {
            e.preventDefault();
            container.parentElement.classList.remove('drag-over');
        });

        container.addEventListener('dragover', (e) => {
            e.preventDefault();
        });

        // for creating new elements
        container.addEventListener('drop', (e) => {
            e.preventDefault();
            container.parentElement.classList.remove('drag-over');
            
            const mappingType = e.dataTransfer.getData('application/mapping-type');
            if (!mappingType) return;
            
            // Calculate drop position
            const stageRect = container.getBoundingClientRect();
            
            let x = (e.clientX - stageRect.left);
            let y = (e.clientY - stageRect.top);

            const pos = this.scaleManager.normalizePosition(x, y);
            const source = {
                comment: '',
                type: mappingType,
                [this.nodeManager.getTypePositionKeyName(mappingType)]: pos
            };

            const node = this.nodeManager.createNode(source);
            if (node) {
                this.nodeManager.selectNode(node);
            }
        });

        // Make mapping types draggable
        document.querySelectorAll('.mapping-type-item').forEach(element => {
            element.addEventListener('dragstart', (e) => {
                e.dataTransfer.setData('application/mapping-type', e.target.dataset.type);
                
                // Create a temporary element for the drag image
                const icon = e.target.querySelector('i').cloneNode(true);
                const dragImage = document.createElement('div');
                dragImage.appendChild(icon);
                dragImage.style.position = 'absolute';
                dragImage.style.top = '-1000px';
                dragImage.style.fontSize = '24px'; // Make the icon bigger
                document.body.appendChild(dragImage);
                
                // Set the custom drag image
                e.dataTransfer.setDragImage(dragImage, 15, 15);
                
                // Clean up the temporary element after a short delay
                setTimeout(() => document.body.removeChild(dragImage), 0);
                
                e.target.classList.add('dragging');
            });

            element.addEventListener('dragend', (e) => {
                e.target.classList.remove('dragging');
            });
        });
    }

    setupEventListeners() {
        // Initialize resize handler
        window.addEventListener('resize', () => {
            window.scaleManager.handleResize(this.stage.container());
        });

        // Setup double-click handlers to add mapping types
        document.querySelectorAll('.mapping-type-item').forEach(item => {
            item.addEventListener('dblclick', () => {
                const mappingType = item.dataset.type;
                const pos = {
                    x: 0.5, // Center of the stage
                    y: 0.5  // Center of the stage
                };

                const source = {
                    comment: '',
                    type: mappingType,
                    [this.nodeManager.getTypePositionKeyName(mappingType)]: pos
                };

                const node = this.nodeManager.createNode(source);
                if (node) {
                    this.nodeManager.selectNode(node);
                }
            });
        });

        const deleteZone = document.getElementById('deleteZone');
        
        // Initialize key input fields
        const switchKeyGlobal = document.getElementById('switchKeyGlobal');
        const mappingKeyProperties = document.getElementById('mappingKeyProperties');

        if (switchKeyGlobal) {
            this.keyInputManager.setupKeyListener(switchKeyGlobal, (key) => {
                this.configManager.switchKey = key;
            });
        }

        if (mappingKeyProperties) {
            this.keyInputManager.setupKeyListener(mappingKeyProperties, (key) => {
                mappingKeyProperties.value = key;
                if (this.nodeManager.selectedNode?.supportsKey) {
                    this.nodeManager.selectedNode.setKey(key);
                }
            });
        }

        // Handle stage clicks and drags
        const handleNodeShapeSelection = (shape) => {
            if (shape === this.stage) {
                this.nodeManager.deselectNode();
            } else {
                const mainShape = this.nodeManager.GetMainShapeFromShape(shape);
                
                // If we found a mainShape, select it
                if (mainShape) {
                    const node = this.nodeManager.nodes.find(n => n.shape === mainShape);
                    if (node) {
                        this.nodeManager.selectNode(node);
                    }
                }
            }
        };

        // Handle drag move for live updates
        this.stage.on('dragmove', (e) => {
            const shape = this.nodeManager.GetMainShapeFromShape(e.target);
            // If we found a node and it's selected, update mapping properties
            if (shape && this.nodeManager.selectedNode?.shape === shape) {
                this.nodeManager.updateMappingProperties();
            }
            
            const deleteZoneRect = deleteZone.getBoundingClientRect();
            const isOverDeleteZone = 
                e.evt.clientX >= deleteZoneRect.left &&
                e.evt.clientX <= deleteZoneRect.right &&
                e.evt.clientY >= deleteZoneRect.top &&
                e.evt.clientY <= deleteZoneRect.bottom;

            // Check if the dragged element is over the delete zone
            if (isOverDeleteZone) {
                deleteZone.classList.add('drag-over');
            } else {
                deleteZone.classList.remove('drag-over');
            }
        });

        this.stage.on('click tap', (e) => {
            handleNodeShapeSelection(e.target);
        });

        this.stage.on('dragstart', (e) => {
            const isCtrlPressed = e.evt?.ctrlKey;
            if (isCtrlPressed) {
                e.cancelBubble = true;

                const shape = this.nodeManager.GetMainShapeFromShape(e.target);
                
                // Clone the node and select the source node for movement
                const sourceNode = this.nodeManager.cloneNodeFromShape(shape);
                if (sourceNode) {
                    this.nodeManager.selectNode(sourceNode);
                }
                return;
            }
            handleNodeShapeSelection(e.target);
            deleteZone.classList.add('visible');
        });

        this.stage.on('dragend', (e) => {
            // Hide delete zone
            deleteZone.classList.remove('visible');
            deleteZone.classList.remove('drag-over');

            if (e.target === this.stage) return;
            
            const deleteZoneRect = deleteZone.getBoundingClientRect();
            
            // Check if released over delete zone
            const isOverDeleteZone = 
                e.evt.clientX >= deleteZoneRect.left &&
                e.evt.clientX <= deleteZoneRect.right &&
                e.evt.clientY >= deleteZoneRect.top &&
                e.evt.clientY <= deleteZoneRect.bottom;
        
            if (isOverDeleteZone) {
                if (this.nodeManager.selectedNode) {
                    const node = this.nodeManager.selectedNode;
                    if (node && node.type === 'KMT_CLICK_MULTI') {
                        // For multi-click elements, handle point deletion
                        node.deletePoint(e.target);
                    } else {
                        // For other elements, delete the entire node
                        this.nodeManager.deleteSelectedNode();
                    }
                }
            }
        });

        // Handle form changes
        const mappingForm = document.getElementById('mappingForm');
        if (mappingForm) {
            // Remove form submit handler
            mappingForm.onsubmit = null;

            // Handle comment change
            const commentInput = mappingForm.querySelector('#mappingComment');
            if (commentInput) {
                commentInput.addEventListener('change', () => {
                    if (!this.nodeManager.selectedNode) return;
                    this.nodeManager.selectedNode.mappingData.comment = commentInput.value;
                });
            }

            // Handle type change
            const typeSelect = mappingForm.querySelector('#mappingType');
            if (typeSelect) {
                typeSelect.addEventListener('change', () => {
                    if (this.nodeManager.selectedNode) {
                        this.nodeManager.selectedNode.mappingData.type = typeSelect.value;
                    }
                });
            }

            // Handle key change
            const keyInput = mappingForm.querySelector('#mappingKey');
            if (keyInput) {
                ['input', 'change'].forEach(eventType => {
                    keyInput.addEventListener(eventType, () => {
                        if (this.nodeManager.selectedNode) {
                            this.nodeManager.selectedNode.mappingData.key = keyInput.value;
                        }
                    });
                });
            }

            // Handle opacity change
            const opacityRange = document.getElementById('opacityRange');
            if (opacityRange) {
                opacityRange.addEventListener('input', () => {
                    if (!this.nodeManager.selectedNode) return;
                    const opacity = parseInt(opacityRange.value) / 100;
                    this.nodeManager.selectedNode.setOpacity(opacity);
                });
            }


            // Handle switch map change
            const switchMapCheckbox = mappingForm.querySelector('#switchMap');
            if (switchMapCheckbox) {
                switchMapCheckbox.addEventListener('change', () => {
                    if (!this.nodeManager.selectedNode) return;
                    if (this.nodeManager.selectedNode.mappingData.type === MAPPING_TYPES.MOUSE_MOVE) {
                        if (this.nodeManager.selectedNode.mappingData.smallEyes) {
                            this.nodeManager.selectedNode.mappingData.smallEyes.switchMap = switchMapCheckbox.checked;
                        }
                    } else {
                        this.nodeManager.selectedNode.mappingData.switchMap = switchMapCheckbox.checked;
                    }
                });
            }
        }

        // Handle delete mapping
        document.getElementById('deleteMapping').addEventListener('click', () => {
            if (this.nodeManager.selectedNode && confirm('Are you sure you want to delete this node?')) {
                this.nodeManager.deleteSelectedNode();
            }
        });
    }

    setupBackgroundHandling() {
        const uploadInput = document.getElementById('uploadBackground');
        if (!uploadInput) return;

        uploadInput.addEventListener('change', (event) => {
            if (event.target.files && event.target.files[0]) {
                const file = event.target.files[0];
                const reader = new FileReader();

                reader.onload = (e) => {
                    const image = new Image();
                    image.src = e.target.result;

                    image.onload = () => {
                        // Remove existing background if any
                        const existingBg = this.layer.findOne('.background');
                        if (existingBg) {
                            existingBg.destroy();
                        }

                        // Calculate scaled dimensions while maintaining aspect ratio
                        const containerWidth = this.stage.width();
                        const containerHeight = this.stage.height();
                        const imageAspectRatio = image.width / image.height;
                        const containerAspectRatio = containerWidth / containerHeight;

                        let scaledWidth, scaledHeight;
                        let x = 0, y = 0;

                        if (imageAspectRatio > containerAspectRatio) {
                            // Image is wider than container (relative to aspect ratio)
                            scaledWidth = containerWidth;
                            scaledHeight = containerWidth / imageAspectRatio;
                            y = (containerHeight - scaledHeight) / 2; // Center vertically
                        } else {
                            // Image is taller than container (relative to aspect ratio)
                            scaledHeight = containerHeight;
                            scaledWidth = containerHeight * imageAspectRatio;
                            x = (containerWidth - scaledWidth) / 2; // Center horizontally
                        }

                        // Create and add background image
                        const background = new Konva.Image({
                            x: x,
                            y: y,
                            image: image,
                            width: scaledWidth,
                            height: scaledHeight,
                            name: 'background'
                        });

                        // Store original dimensions for resize calculations
                        background.setAttr('originalWidth', image.width);
                        background.setAttr('originalHeight', image.height);
                        
                        this.layer.add(background);
                        background.moveToBottom();
                        
                        // Update nodes positions after setting the new background
                        if (window.scaleManager) {
                            window.scaleManager._updateNodesShapePositions();
                        }
                        
                        this.layer.batchDraw();
                    };
                };

                reader.readAsDataURL(file);
            }
        });
    }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new App();
});
