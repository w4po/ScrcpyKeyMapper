import { DragNode } from '../nodes/DragNode.js';
import { ClickNode } from '../nodes/ClickNode.js';
import { MultiClickNode } from '../nodes/MultiClickNode.js';
import { SteerWheelNode } from '../nodes/SteerWheelNode.js';
import { MouseMoveNode } from '../nodes/MouseMoveNode.js';
import { MAPPING_TYPES } from '../utils/constants.js';
import { KeyDisplayManager } from './KeyDisplayManager.js';

export class NodeManager {
    constructor(stage, layer) {
        this.stage = stage;
        this.layer = layer;
        this.nodes = [];
        this.selectedNode = null;
        this.nodeListContainer = document.getElementById('nodeList');
        this.nodeCountElement = document.getElementById('nodeCount');
        this.setupNodeListEvents();
        this.setupScaleControl();
        this.setupZIndexControls();
        this.scaleInterval = null;
        this.scaleStep = 0.05;
        this.scaleUpdateDelay = 100; // milliseconds between updates when holding
    }

    setupNodeListEvents() {
        // Handle click events on the node list container
        this.nodeListContainer.addEventListener('click', (e) => {
            const listItem = e.target.closest('.node-list-item');
            if (!listItem) return;

            const nodeIndex = parseInt(listItem.dataset.nodeIndex);
            if (!isNaN(nodeIndex) && nodeIndex >= 0 && nodeIndex < this.nodes.length) {
                this.selectNode(this.nodes[nodeIndex], true); // Pass true to indicate selection from list
            }
        });
    }

    setupScaleControl() {
        const scaleInput = document.getElementById('nodeScale');
        const decreaseBtn = document.getElementById('decreaseScale');
        const increaseBtn = document.getElementById('increaseScale');

        // Load saved scale or use default
        const savedScale = localStorage.getItem('nodeScale') || '1.0';
        scaleInput.value = savedScale;
        this.nodes.forEach(node => node.setScale(parseFloat(savedScale)));

        const updateScale = (newValue) => {
            // Ensure value is within bounds
            const scale = Math.min(Math.max(parseFloat(newValue) || 1.0, 0.5), 2.0);
            // Format to 2 decimal places
            const formattedScale = scale.toFixed(2);
            scaleInput.value = formattedScale;
            localStorage.setItem('nodeScale', formattedScale);
            
            // Update all nodes with new scale
            this.nodes.forEach(node => {
                node.setScale(scale);
            });
        };

        // Input validation
        scaleInput.addEventListener('input', (e) => {
            if (e.target.value === '') return;
            updateScale(e.target.value);
        });

        // Add mousedown and mouseup handlers for continuous scaling
        decreaseBtn.addEventListener('mousedown', () => this.startContinuousScale('decrease'));
        decreaseBtn.addEventListener('mouseup', () => this.stopContinuousScale());
        decreaseBtn.addEventListener('mouseleave', () => this.stopContinuousScale());

        increaseBtn.addEventListener('mousedown', () => this.startContinuousScale('increase'));
        increaseBtn.addEventListener('mouseup', () => this.stopContinuousScale());
        increaseBtn.addEventListener('mouseleave', () => this.stopContinuousScale());
    }

    setupZIndexControls() {
        const moveBackBtn = document.getElementById('moveNodeBack');
        const moveFrontBtn = document.getElementById('moveNodeFront');
        const clearAllBtn = document.getElementById('clearAllNodes');

        moveBackBtn.addEventListener('click', () => this.moveSelectedNode('back'));
        moveFrontBtn.addEventListener('click', () => this.moveSelectedNode('front'));
        clearAllBtn.addEventListener('click', () => {
            if (confirm('Are you sure you want to clear all nodes? This action cannot be undone.')) {
                this.clearAllNodes();
            }
        });
    }
    moveSelectedNode(direction) {
        if (!this.selectedNode) return;
        
        if (direction === 'back') {
            // Move to bottom and then one step up to be above background
            this.selectedNode.shape.moveToBottom();
            this.selectedNode.shape.moveUp();
        } else {
            // Move to the very top
            this.selectedNode.shape.moveToTop();
        }

        this.layer.batchDraw();
    }

    startContinuousScale(direction) {
        if (this.scaleInterval) return;
        
        const updateScale = () => {
            const currentScale = parseFloat(document.getElementById('nodeScale').value);
            let newScale;
            
            if (direction === 'increase') {
                newScale = Math.min(currentScale + this.scaleStep, 5.0);
            } else {
                newScale = Math.max(currentScale - this.scaleStep, 0.1);
            }
            
            if (newScale !== currentScale) {
                document.getElementById('nodeScale').value = newScale.toFixed(1);
                const scale = Math.min(Math.max(newScale || 1.0, 0.5), 2.0);
                const formattedScale = scale.toFixed(2);
                document.getElementById('nodeScale').value = formattedScale;
                localStorage.setItem('nodeScale', formattedScale);
                
                // Update all nodes with new scale
                this.nodes.forEach(node => {
                    node.setScale(scale);
                });
            }
        };

        // Initial update
        updateScale();
        
        // Start continuous updates
        this.scaleInterval = setInterval(updateScale, this.scaleUpdateDelay);
    }

    stopContinuousScale() {
        if (this.scaleInterval) {
            clearInterval(this.scaleInterval);
            this.scaleInterval = null;
        }
    }

    updateNodeCount() {
        if (this.nodeCountElement) {
            this.nodeCountElement.textContent = this.nodes.length.toString();
        }
    }
    addToNodeList(node, updateCount = true) {
        if (!this.nodeListContainer) return;

        const listItem = document.createElement('div');
        listItem.className = 'node-list-item';
        if (this.selectedNode === node) {
            listItem.classList.add('selected');
        }
        listItem.dataset.nodeIndex = this.nodeListContainer.children.length ;
        listItem.dataset.type = node.mappingData.type;
        
        // Add orderNumber
        const order = document.createElement('span');
        order.textContent = this.nodeListContainer.children.length + 1;
        listItem.appendChild(order);

        // Add icon based on type
        const icon = document.createElement('i');
        icon.className = this.getNodeIcon(node.mappingData.type);
        listItem.appendChild(icon);
        
        // Add label
        const label = document.createElement('span');
        label.textContent = this.getNodeLabel(node);
        listItem.appendChild(label);
        
        this.nodeListContainer.appendChild(listItem);

        // Update the node count
        if (updateCount) this.updateNodeCount();
    }
    updateNodeListSelection() {
        if (!this.nodeListContainer) return;
        
        Array.from(this.nodeListContainer.children).forEach((listItem, index) => {
            if (this.selectedNode === this.nodes[index]) {
                listItem.classList.add('selected');
                window.scaleManager.scrollContainerOnly(listItem);
            } else {
                listItem.classList.remove('selected');
            }
        });
    }
    updateNodeList() {
        if (!this.nodeListContainer) return;
        
        // If nodes array length doesn't match list items, rebuild the entire list
        if (this.nodeListContainer.children.length !== this.nodes.length) {
            
            // Update the node count
            this.updateNodeCount();
            
            // Clear existing items
            this.nodeListContainer.innerHTML = '';
            
            // Add items for each node
            this.nodes.forEach((node) => {
                this.addToNodeList(node, false);
            });
        }
    }

    getNodeIcon(type) {
        switch (type) {
            case MAPPING_TYPES.CLICK: return 'bi bi-hand-index-fill';
            case MAPPING_TYPES.CLICK_TWICE: return 'bi bi-2-circle-fill';
            case MAPPING_TYPES.CLICK_MULTI: return 'bi bi-bezier2';
            case MAPPING_TYPES.DRAG: return 'bi bi-arrow-down-up';
            case MAPPING_TYPES.STEER_WHEEL: return 'bi bi-dpad-fill';
            case MAPPING_TYPES.MOUSE_MOVE: return 'bi bi-mouse2-fill';
            default: return 'bi bi-question-circle-fill';
        }
    }

    getNodeLabel(node) {
        const type = this.getTypeName(node.mappingData.type);
        
        let keyBinding = '';
        if (node.mappingData.type === MAPPING_TYPES.MOUSE_MOVE && node.mappingData.smallEyes?.enabled) {
            keyBinding = KeyDisplayManager.formatKeyText(node.mappingData.smallEyes.key);
        }
        else if (node.mappingData.type === MAPPING_TYPES.STEER_WHEEL) {
            const left = KeyDisplayManager.formatKeyText(node.mappingData.leftKey);
            const right = KeyDisplayManager.formatKeyText(node.mappingData.rightKey);
            const up = KeyDisplayManager.formatKeyText(node.mappingData.upKey);
            const down = KeyDisplayManager.formatKeyText(node.mappingData.downKey);
            keyBinding = `${up} ${left} ${down} ${right}`;
        }
        else {
            keyBinding = KeyDisplayManager.formatKeyText(node.mappingData.key);
        }

        let comment = node.mappingData.comment;
        if (comment && comment.length > 22) {
            comment = comment.substring(0, 20) + '...';
        }
        let result = type;
        if (keyBinding.length > 0) {
            result += ` - (${keyBinding})`;
        }
        if (comment?.length > 0) {
            result += ` - ${comment}`;
        }

        return result;
    }

    GetMainShapeFromShape(shape) {
        // Find the mainShape group from the target
        let current = shape;
        while (current && !current.hasName('mainShape')) {
            current = current.parent;
        }

        if (!current || !current.hasName('mainShape')) return null;
        
        return current;
    }

    createNode(source) {
        let node;
        switch (source.type) {
            case MAPPING_TYPES.CLICK:
            case MAPPING_TYPES.CLICK_TWICE:
                node = new ClickNode(this.stage, source);
                break;
            case MAPPING_TYPES.CLICK_MULTI:
                let dragPos = source.pos;
                delete source.pos;
                node = new MultiClickNode(this.stage, source, dragPos);
                break;
            case MAPPING_TYPES.DRAG:
                node = new DragNode(this.stage, source);
                break;
            case MAPPING_TYPES.STEER_WHEEL:
                node = new SteerWheelNode(this.stage, source);
                break;
            case MAPPING_TYPES.MOUSE_MOVE:
                node = new MouseMoveNode(this.stage, source);
                break;
            default:
                console.warn('Unsupported mapping type:', source.type);
                return;
        }

        // Set initial opacity if provided
        if (source.opacity) {
            node.setOpacity(source.opacity);
        }
        const initialOpacity = source.opacity || 1;
        node.shape.opacity(initialOpacity);
        // Store the initial opacity on the node for reference
        node.initialOpacity = initialOpacity;

        this.nodes.push(node);
        this.layer.add(node.shape);
        this.layer.batchDraw();

        // add to node list (HTML)
        this.addToNodeList(node);

        return node;
    }

    cloneNodeFromShape(shape) {
        // Find the source node from the shape
        const sourceNode = this.nodes.find(node => node.shape === shape);
        if (!sourceNode) return null;
        
        // Create a deep copy of the mapping data
        const clonedMappingData = JSON.parse(JSON.stringify(sourceNode.mappingData));
        
        // Create a cloned node (and leave it in the same position)
        this.createNode(clonedMappingData);

        // Return the source node for selection
        return sourceNode;
    }

    selectNode(node, fromHTML = false) {
        // Deselect previous node
        if (this.selectedNode) {
            this.selectedNode.shape.fire('deselect');
            if (this.selectedNode.pulseAnimation) {
                this.selectedNode.pulseAnimation.stop();
                // Restore to initial opacity
                if (this.selectedNode.shape.opacity) {
                    this.selectedNode.shape.opacity(this.selectedNode.initialOpacity);
                }
                this.layer.batchDraw();
            }
        }

        // Select new node
        this.selectedNode = node;
        if (node) {
            node.shape.fire('select');
            this.updateMappingProperties();
            
            // Only create pulsing animation if selected from list
            if (fromHTML) {
                node.pulseAnimation = new Konva.Animation((frame) => {
                    if (!frame) return;
                    
                    // Pulse opacity between initial and 0.3
                    const opacityDelta = Math.sin(frame.time * 0.01) * 0.35;
                    node.shape.opacity(Math.max(0.3, node.initialOpacity - opacityDelta));
                }, this.layer);

                // Start animation and stop after 1 second
                node.pulseAnimation.start();
                setTimeout(() => {
                    if (node.pulseAnimation) {
                        node.pulseAnimation.stop();
                        node.shape.opacity(node.initialOpacity);
                        this.layer.batchDraw();
                        node.pulseAnimation = null;
                    }
                }, 1000);
            }
        }

        // Update node list selection
        this.updateNodeListSelection();
    }

    deselectNode() {
        const moveBackBtn = document.getElementById('moveNodeBack');
        const moveFrontBtn = document.getElementById('moveNodeFront');
        if (moveBackBtn && moveFrontBtn) {
            moveBackBtn.disabled = true;
            moveFrontBtn.disabled = true;
        }

        if (!this.selectedNode) return;

        if (this.selectedNode.pulseAnimation) {
            this.selectedNode.pulseAnimation.stop();
        }

        this.selectedNode.shape.fire('deselect');
        this.selectedNode = null;
        this.updateNodeListSelection();

        // Clear form fields
        const mappingForm = document.getElementById('mappingForm');
        if (mappingForm) {
            const commentInput = mappingForm.querySelector('#mappingComment');
            const typeLabel = mappingForm.querySelector('#mappingTypeLabel');
            const keyInput = mappingForm.querySelector('#mappingKeyProperties');
            const switchMapCheckbox = mappingForm.querySelector('#switchMap');
            const deleteButton = mappingForm.querySelector('#deleteMapping');
            const opacityRange = document.getElementById('opacityRange');

            commentInput.value = '';
            commentInput.disabled = true;
            typeLabel.textContent = '';
            typeLabel.disabled = true;
            keyInput.value = '';
            keyInput.disabled = true;
            switchMapCheckbox.checked = false;
            switchMapCheckbox.disabled = true;
            opacityRange.disabled = true;
            deleteButton.disabled = true;
        }

        // Clear mapping properties
        const mappingProperties = document.getElementById('mappingPropertiesContent');
        if (mappingProperties) {
            mappingProperties.innerHTML = '';
        }
    }

    deleteSelectedNode() {
        if (this.selectedNode) {
            const index = this.nodes.indexOf(this.selectedNode);
            if (index !== -1) {
                this.nodes.splice(index, 1);
                const shape = this.selectedNode.shape;
                this.deselectNode();
                shape.destroy();
                this.layer.batchDraw();
                
                // Update node list after deletion
                this.updateNodeList();
            }
        }
    }

    // Get human-readable type name
    getTypeName(type) {
        switch (type) {
            case MAPPING_TYPES.CLICK: return 'Single Click';
            case MAPPING_TYPES.CLICK_TWICE: return 'Double Click';
            case MAPPING_TYPES.CLICK_MULTI: return 'Multi Click';
            case MAPPING_TYPES.DRAG: return 'Drag';
            case MAPPING_TYPES.STEER_WHEEL: return 'Steering Wheel';
            case MAPPING_TYPES.MOUSE_MOVE: return 'Mouse Map';
            default: return type;
        }
    }
    getTypePositionKeyName(type) {
        switch (type) {
            case MAPPING_TYPES.DRAG:
            case MAPPING_TYPES.MOUSE_MOVE:
                return 'startPos';
            case MAPPING_TYPES.STEER_WHEEL:
                return 'centerPos';
            default:
                return 'pos';
        }
    }

    // Generate HTML content for mapping properties
    getMappingPropertiesContent(node) {
        switch (node.mappingData.type) {
            case MAPPING_TYPES.CLICK:
                const clickPos = node.mappingData.pos;
                return `
                    <div class="mb-3">
                        <label class="form-label">Single Click</label>
                        <div class="form-text">Click at the specified position</div>
                        <div class="mt-2">
                            <pre class="form-control">Position: (${(clickPos.x).toFixed(3)}, ${(clickPos.y).toFixed(3)})</pre>
                        </div>
                    </div>
                `;

            case MAPPING_TYPES.CLICK_TWICE:
                const doubleClickPos = node.mappingData.pos;
                return `
                    <div class="mb-3">
                        <label class="form-label">Double Click</label>
                        <div class="form-text">Double click at the specified position</div>
                        <div class="mt-2">
                            <pre class="form-control">Position: (${(doubleClickPos.x).toFixed(3)}, ${(doubleClickPos.y).toFixed(3)})</pre>
                        </div>
                    </div>
                `;

            case MAPPING_TYPES.CLICK_MULTI:
                if (node.mappingData.clickNodes) {
                    const clickNodesInfo = node.mappingData.clickNodes
                        .map(clickNode => `Point ${clickNode.order}: (${(clickNode.pos.x).toFixed(3)}, ${(clickNode.pos.y).toFixed(3)}) - Delay ${clickNode.delay}ms`)
                        .join('\n');
                    
                    return `
                        <div class="mb-3">
                            <label class="form-label">Multi-Click Points</label>
                            <pre class="form-control">${clickNodesInfo}</pre>
                            <div class="form-text mt-2">
                                • Right-click to add points<br>
                                • Double-click points to edit delay<br>
                                • Drag points to reposition<br>
                                • Click delete button to remove points
                            </div>
                        </div>
                    `;
                }
                break;

            case MAPPING_TYPES.DRAG:
                const startPos = node.mappingData.startPos || { x: 0, y: 0 };
                const endPos = node.mappingData.endPos || { x: 0, y: 0 };
                const startDelay = node.mappingData.startDelay || 0;
                const dragSpeed = node.mappingData.dragSpeed || 1;
                return `
                    <div class="mb-3">
                        <label class="form-label">Start Delay (ms)</label>
                        <input type="number" class="form-control" id="dragStartDelay" value="${startDelay}" min="0" max="2000" step="20">
                        <div class="form-text mt-2">
                            • Time to hold before starting drag
                        </div>
                    </div>
                    <div class="mb-3">
                        <label class="form-label">Drag Speed</label>
                        <input type="number" class="form-control" id="dragSpeed" value="${dragSpeed}" min="0" max="1" step="0.01">
                        <div class="form-text mt-2">
                            • 1 is fastest, 0 is slowest
                        </div>
                    </div>
                    <div class="mb-3">
                        <label class="form-label">Drag Path</label>
                        <pre class="form-control">Start: (${(startPos.x).toFixed(3)}, ${(startPos.y).toFixed(3)})
End: (${(endPos.x).toFixed(3)}, ${(endPos.y).toFixed(3)})</pre>
                        <div class="form-text mt-2">
                            • Drag endpoints to adjust path<br>
                            • Path defines mouse movement
                        </div>
                    </div>
                `;

            case MAPPING_TYPES.STEER_WHEEL:
                const centerPos = node.mappingData.centerPos;
                return `
                    <div class="mb-3">
                        <label class="form-label">Steering Wheel</label>
                        <div class="mt-2">
                            <pre class="form-control">Center: (${(centerPos.x).toFixed(3)}, ${(centerPos.y).toFixed(3)})</pre>
                        </div>
                        <div class="mt-3">
                            <label class="form-label">Key Bindings</label>
                            <div class="input-group mb-2">
                                <span class="input-group-text" style="min-width: 70px;">Up</span>
                                <input type="text" class="form-control key-binding" data-direction="up" value="${node.mappingData.upKey || 'Key_W'}" />
                                <span class="input-group-text">Offset: ${(node.mappingData.upOffset || 0.27).toFixed(3)}</span>
                            </div>
                            <div class="input-group mb-2">
                                <span class="input-group-text" style="min-width: 70px;">Down</span>
                                <input type="text" class="form-control key-binding" data-direction="down" value="${node.mappingData.downKey || 'Key_S'}" />
                                <span class="input-group-text">Offset: ${(node.mappingData.downOffset || 0.2).toFixed(3)}</span>
                            </div>
                            <div class="input-group mb-2">
                                <span class="input-group-text" style="min-width: 70px;">Left</span>
                                <input type="text" class="form-control key-binding" data-direction="left" value="${node.mappingData.leftKey || 'Key_A'}" />
                                <span class="input-group-text">Offset: ${(node.mappingData.leftOffset || 0.1).toFixed(3)}</span>
                            </div>
                            <div class="input-group mb-2">
                                <span class="input-group-text" style="min-width: 70px;">Right</span>
                                <input type="text" class="form-control key-binding" data-direction="right" value="${node.mappingData.rightKey || 'Key_D'}" />
                                <span class="input-group-text">Offset: ${(node.mappingData.rightOffset || 0.1).toFixed(3)}</span>
                            </div>
                        </div>
                        <div class="form-text mt-2">
                            • Drag center wheel to reposition<br>
                            • Drag direction buttons to adjust offsets<br>
                            • Click input fields to change key bindings
                        </div>
                    </div>
                `;

            case MAPPING_TYPES.MOUSE_MOVE:
                const speedRatioX = node.mappingData.speedRatioX || 1.0;
                const speedRatioY = node.mappingData.speedRatioY || 1.0;
                const smallEyes = node.mappingData.smallEyes || { enabled: false, key: 'Key_RightButton' };

                return `
                    <div>
                        <div class="mb-3">
                            <label class="form-label">Position</label>
                            <pre class="form-control">Start: (${(node.mappingData.startPos.x).toFixed(3)}, ${(node.mappingData.startPos.y).toFixed(3)})</pre>
                        </div>
                        <div class="mb-3">
                            <label class="form-label">Speed Ratios</label>
                            <div class="input-group mb-2">
                                <span class="input-group-text">X Ratio</span>
                                <input type="number" step="0.01" min="0.001" class="form-control speed-ratio" data-axis="x" value="${speedRatioX}" />
                            </div>
                            <div class="input-group mb-2">
                                <span class="input-group-text">Y Ratio</span>
                                <input type="number" step="0.01" min="0.001" class="form-control speed-ratio" data-axis="y" value="${speedRatioY}" />
                            </div>
                        </div>
                        <div class="mb-3">
                            <label class="form-label">Small Eyes</label>
                            <div class="form-check mb-2">
                                <input class="form-check-input" type="checkbox" id="smallEyesEnabled" ${smallEyes.enabled ? 'checked' : ''}>
                                <label class="form-check-label" for="smallEyesEnabled">Enable smallEyes</label>
                            </div>
                            <div class="input-group">
                                <span class="input-group-text">Key</span>
                                <input type="text" class="form-control" id="smallEyesKey" value="${smallEyes.key}" ${!smallEyes.enabled ? 'disabled' : ''}>
                            </div>
                        </div>
                        <div class="form-text mt-2">
                            • Drag the node to reposition<br>
                            • Adjust speed ratios to control sensitivity<br>
                            • Enable smallEyes for additional control
                        </div>
                    </div>
                `;

            default:
                return '';
        }
    }

    updateMappingProperties() {
        if (!this.selectedNode) return;
        const mappingData = this.selectedNode.mappingData;

        const propertiesContainer = document.getElementById('mappingPropertiesContent');
        const mappingForm = document.getElementById('mappingForm');
        if (!propertiesContainer || !mappingForm) return;

        const moveBackBtn = document.getElementById('moveNodeBack');
        const moveFrontBtn = document.getElementById('moveNodeFront');
        if (moveBackBtn && moveFrontBtn) {
            moveBackBtn.disabled = false;
            moveFrontBtn.disabled = false;
        }

        // Update Comment
        const commentInput = mappingForm.querySelector('#mappingComment');
        if (commentInput) {
            commentInput.disabled = false;
            commentInput.value = mappingData.comment || '';
        }

        // Update type label
        const typeLabel = mappingForm.querySelector('#mappingTypeLabel');
        if (typeLabel) {
            typeLabel.disabled = false;
            typeLabel.textContent = this.getTypeName(mappingData.type);
        }

        // Update key input value and visibility
        const keyInput = mappingForm.querySelector('#mappingKeyProperties');
        const keyInputContainer = mappingForm.querySelector('#mappingKeyPropertiesContainer');
        if (keyInput && keyInputContainer) {
            keyInput.disabled = false;
            if (mappingData.type === MAPPING_TYPES.STEER_WHEEL ||
                mappingData.type === MAPPING_TYPES.MOUSE_MOVE) {
                keyInputContainer.style.display = 'none';
            } else {
                keyInputContainer.style.display = '';
                keyInput.value = mappingData.key || '';
            }
        }

        // Set up opacity control
        const opacityRange = document.getElementById('opacityRange');
        if (opacityRange) {
            opacityRange.disabled = false;
            // Set initial value
            const currentOpacity = this.selectedNode.shape.opacity() || 1;
            opacityRange.value = Math.round(currentOpacity * 100);
        }

        // Update switch map checkbox
        const switchMapCheckbox = mappingForm.querySelector('#switchMap');
        if (switchMapCheckbox) {
            switchMapCheckbox.disabled = false;
            let isChecked;
            if (mappingData.type === MAPPING_TYPES.MOUSE_MOVE) {
                // For mouse move, get switchMap from smallEyes
                isChecked = mappingData.smallEyes?.switchMap || false;
            } else {
                // For other mappings, get from mapping data
                isChecked = mappingData.switchMap || false;
            }
            switchMapCheckbox.checked = isChecked;
        }

        // Update delete button
        const deleteButton = mappingForm.querySelector('#deleteMapping');
        if (deleteButton) {
            deleteButton.disabled = false;
        }

        // Update the content
        propertiesContainer.innerHTML = this.getMappingPropertiesContent(this.selectedNode);


        // If it's a steering wheel, set up the key bindings
        if (mappingData.type === MAPPING_TYPES.STEER_WHEEL) {
            // Get all key binding inputs within the properties container
            const keyInputs = propertiesContainer.querySelectorAll('.key-binding');
            keyInputs.forEach(input => {
                const direction = input.dataset.direction;
                if (direction) {
                    // Make the input focusable
                    input.tabIndex = 0;
                    
                    // Set up click handler to focus
                    input.addEventListener('click', () => {
                        input.focus();
                    });

                    // Set up the key listener
                    window.keyInputManager.setupKeyListener(input, (key) => {
                        if (!this.selectedNode) return;
                        
                        input.value = key;
                        
                        this.selectedNode.setDirectionKey(direction, key, true);
                    });
                }
            });
        }

        // If it's a mouse move mapping, set up speed ratio handlers
        if (mappingData.type === MAPPING_TYPES.MOUSE_MOVE) {
            const speedInputs = propertiesContainer.querySelectorAll('.speed-ratio');
            speedInputs.forEach(input => {
                input.addEventListener('change', () => {
                    if (!this.selectedNode) return;
                    
                    const speedRatioX = parseFloat(propertiesContainer.querySelector('[data-axis="x"]').value) || 1;
                    const speedRatioY = parseFloat(propertiesContainer.querySelector('[data-axis="y"]').value) || 1;
                    
                    this.selectedNode.setSpeedRatios(speedRatioX, speedRatioY);
                });
            });

            // Set up small eyes handlers
            const smallEyesEnabled = propertiesContainer.querySelector('#smallEyesEnabled');
            const smallEyesKey = propertiesContainer.querySelector('#smallEyesKey');

            smallEyesEnabled.addEventListener('change', () => {
                if (!this.selectedNode) return;
                smallEyesKey.disabled = !smallEyesEnabled.checked;
                this.selectedNode.setSmallEyes({
                    enabled: smallEyesEnabled.checked,
                    key: smallEyesKey.value
                });
            });

            smallEyesKey.tabIndex = 0;
            smallEyesKey.addEventListener('click', () => {
                if (!smallEyesEnabled.checked) return;
                smallEyesKey.focus();
            });

            window.keyInputManager.setupKeyListener(smallEyesKey, (key) => {
                if (!this.selectedNode || !smallEyesEnabled.checked) return;
                smallEyesKey.value = key;
                this.selectedNode.setSmallEyesKey(key);
            });

            // Set up small eyes key input listener
            smallEyesKey.addEventListener('change', () => {
                if (!this.selectedNode || !smallEyesEnabled.checked) return;
                this.selectedNode.setSmallEyesKey(smallEyesKey.value);
            });
        }

        // If it's a drag mapping, set up start delay and drag speed handlers
        if (mappingData.type === MAPPING_TYPES.DRAG) {
            const startDelayInput = propertiesContainer.querySelector('#dragStartDelay');
            const dragSpeedInput = propertiesContainer.querySelector('#dragSpeed');

            startDelayInput.addEventListener('change', () => {
                if (!this.selectedNode) return;
                this.selectedNode.setStartDelay(parseFloat(startDelayInput.value));
            });

            dragSpeedInput.addEventListener('change', () => {
                if (!this.selectedNode) return;
                this.selectedNode.setDragSpeed(parseFloat(dragSpeedInput.value));
            });
        }
    }

    getMappingsData() {
        return this.nodes.map(node => node.mappingData);
    }

    clearAllNodes() {
        this.deselectNode();
        this.nodes.forEach(node => {
            node.shape.destroy();
        });
        this.nodes = [];
        this.layer.batchDraw();
        
        // Update node list after clearing
        this.updateNodeList();
    }
}
