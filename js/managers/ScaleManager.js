import { MultiClickNode } from '../nodes/MultiClickNode.js';

export class ScaleManager {
    constructor(stage, layer) {
        this.stage = stage;
        this.layer = layer;
        this.resizeTimeout = null;
    }

    handleResize(container) {
        // Clear the timeout if it exists
        if (this.resizeTimeout) {
            clearTimeout(this.resizeTimeout);
        }

        // Set a new timeout to prevent multiple rapid updates
        this.resizeTimeout = setTimeout(() => {
            this._updateStageDimensions(container);
            this._updateBackgroundImage();
            this._updateNodesShapePositions();
            this.layer.batchDraw();
        }, 100);
    }

    _updateStageDimensions(container) {
        const newRect = container.getBoundingClientRect();

        // Ensure minimum dimensions
        const width = Math.max(newRect.width, 300);
        const height = Math.max(newRect.height, 300);

        this.stage.width(width);
        this.stage.height(height);
    }

    _updateBackgroundImage() {
        const background = this.layer.findOne('.background');
        if (!background) return;

        const { width: scaledWidth, height: scaledHeight, x, y } = this._calculateBackgroundDimensions(background);

        background.size({ width: scaledWidth, height: scaledHeight });
        background.position({ x, y });
    }

    _calculateBackgroundDimensions(background) {
        const imageWidth = background.getAttr('originalWidth');
        const imageHeight = background.getAttr('originalHeight');
        const imageAspectRatio = imageWidth / imageHeight;

        const containerWidth = this.stage.width();
        const containerHeight = this.stage.height();
        const containerAspectRatio = containerWidth / containerHeight;

        let scaledWidth, scaledHeight;
        let x = 0, y = 0;

        if (imageAspectRatio > containerAspectRatio) {
            scaledWidth = containerWidth;
            scaledHeight = containerWidth / imageAspectRatio;
            y = (containerHeight - scaledHeight) / 2;
        } else {
            scaledHeight = containerHeight;
            scaledWidth = containerHeight * imageAspectRatio;
            x = (containerWidth - scaledWidth) / 2;
        }

        return { width: scaledWidth, height: scaledHeight, x, y };
    }

    _updateNodesShapePositions() {
        // Get the background image dimensions
        const background = this.layer.findOne('.background');
        if (!background) return;

        // Store original background dimensions for scaling
        const originalWidth = background.getAttr('originalWidth');
        const originalHeight = background.getAttr('originalHeight');
        if (!originalWidth || !originalHeight) return;

        // Update each node's position based on the new background dimensions
        window.nodeManager.nodes.forEach(node => {
            if (!node || !node.shape) return;
            
            // Force update the node's position using stored normalized coordinates
            switch (node.type) {
                case 'KMT_CLICK':
                case 'KMT_CLICK_TWICE':
                    this._updateSingleShapePosition(node);
                    break;
                case 'KMT_DRAG':
                    this._updateDragPosition(node);
                    break;
                case 'KMT_CLICK_MULTI':
                    this._updateMultiClickPosition(node);
                    break;
                case 'KMT_STEER_WHEEL':
                    this._updateSteerWheelPosition(node);
                    break;
                case 'KMT_MOUSE_MOVE':
                    this._updateMouseMovePosition(node);
                    break;
            }
        });

        // Redraw the layer
        this.layer.batchDraw();
    }

    _updateSingleShapePosition(node) {
        const pos = node.mappingData?.pos;
        if (pos) {
            const denormalized = this.denormalizePosition(pos);
            node.shape.position(denormalized);
        }
    }

    _updateDragPosition(node) {
        const { startPos, endPos } = node.mappingData || {};
        if (!startPos || !endPos) return;

        const denormalizedStart = this.denormalizePosition(startPos);
        const denormalizedEnd = this.denormalizePosition(endPos);
        
        const startPoint = node.shape.find('.startPoint')[0];
        const endPoint = node.shape.find('.endPoint')[0];
        const arrow = node.shape.find('.connectionLine')[0];
        
        if (startPoint && endPoint && arrow) {
            startPoint.position(denormalizedStart);
            endPoint.position(denormalizedEnd);
            arrow.points([
                denormalizedStart.x,
                denormalizedStart.y,
                denormalizedEnd.x,
                denormalizedEnd.y
            ]);
        }
    }

    _updateMultiClickPosition(node) {
        const clickNodes = node.shape.find('.clickPoint');
        if (clickNodes.length > 0) {
            // First update all point positions
            clickNodes.forEach(clickNode => {
                if (clickNode.clickData?.pos) {
                    const denormalized = this.denormalizePosition(clickNode.clickData.pos);
                    clickNode.position(denormalized);
                }
            });

            // Then update all lines by calling updateLinePosition for each point
            if (node instanceof MultiClickNode) {
                clickNodes.forEach(clickNode => {
                    node.updateLinePosition(clickNode);
                });
            }
        }
    }

    _updateSteerWheelPosition(node) {
        const wheelPos = node.mappingData.centerPos;
        if (!wheelPos) return;

        const denormalized = this.denormalizePosition(wheelPos);
        node.shape.position(denormalized);
        
        // Update each direction button and its connecting line
        ['left', 'right', 'up', 'down'].forEach(dir => {
            const buttonGroup = node.shape.findOne(`.${dir}Button`);
            const line = node.shape.findOne(`.${dir}Line`);
            const offset = node.mappingData[`${dir}Offset`];
            
            if (buttonGroup && offset) {
                // Use the node's offsetToPixels method for consistent scaling
                const distance = node.offsetToPixels(offset, dir);
                const angle = dir === 'up' ? -Math.PI/2 :
                            dir === 'right' ? 0 :
                            dir === 'down' ? Math.PI/2 :
                            Math.PI;  // left
                
                const newX = Math.cos(angle) * distance;
                const newY = Math.sin(angle) * distance;
                buttonGroup.position({x: newX, y: newY});
                
                // Update connecting line
                if (line) {
                    line.points([0, 0, newX, newY]);
                }
            }
        });
    }

    _updateMouseMovePosition(node) {
        const startPos = node.mappingData?.startPos;
        if (!startPos) return;

        const denormalized = this.denormalizePosition(startPos);
        const mouseShape = node.shape.findOne('.mouseShape');
        
        if (mouseShape) {
            node.shape.position(denormalized);
            mouseShape.position({ x: 0, y: 0 });  // Reset mouseShape position since parent is positioned
        }

        // Update small eyes if present
        const smallEyes = node.shape.findOne('.smallEyes');
        if (smallEyes && node.mappingData.smallEyes?.pos) {
            const smallEyesPos = this.denormalizePosition(node.mappingData.smallEyes.pos);
            smallEyes.position({
                x: smallEyesPos.x - node.shape.x(),
                y: smallEyesPos.y - node.shape.y()
            });
            
            // Use node's own method to update the connecting line
            node.updateConnectingLine();
        }
    }

    scrollContainerOnly(listItem) {
        if (!listItem) return;
        
        // Get the parent scrollable container
        const scrollContainer = listItem.closest('.card-body');
        if (!scrollContainer) return;

        // Calculate the scroll position to show the selected item
        const itemTop = listItem.offsetTop;
        const itemHeight = listItem.offsetHeight;
        const containerHeight = scrollContainer.clientHeight;
        const currentScroll = scrollContainer.scrollTop;
        
        // Check if item is not fully visible
        if (itemTop < currentScroll || itemTop + itemHeight > currentScroll + containerHeight) {
            // Scroll the container instead of the item
            scrollContainer.scrollTo({
                top: itemTop - (containerHeight / 2) + (itemHeight / 2),
                behavior: 'smooth'
            });
        }
    }

    getStageWidth() {
        return this.stage.width();
    }

    getStageHeight() {
        return this.stage.height();
    }

    normalizePosition(x, y) {
        const background = this.stage.findOne('.background');
        if (background) {
            // If there's a background, normalize relative to the background image area
            const bgX = background.x();
            const bgY = background.y();
            const bgWidth = background.width();
            const bgHeight = background.height();

            // Convert stage coordinates to background-relative coordinates
            // Subtract the background position to get relative coordinates
            const relX = (x - bgX) / bgWidth;
            const relY = (y - bgY) / bgHeight;

            return {
                x: Number(relX.toFixed(4)),
                y: Number(relY.toFixed(4))
            };
        } else {
            // If no background, normalize relative to stage
            return {
                x: Number((x / this.getStageWidth()).toFixed(4)),
                y: Number((y / this.getStageHeight()).toFixed(4))
            };
        }
    }

    denormalizePosition(pos) {
        const background = this.stage.findOne('.background');
        if (background) {
            // If there's a background, denormalize relative to the background image area
            const bgX = background.x();
            const bgY = background.y();
            const bgWidth = background.width();
            const bgHeight = background.height();

            return {
                x: bgX + (pos.x * bgWidth),
                y: bgY + (pos.y * bgHeight)
            };
        } else {
            // If no background, denormalize relative to stage
            return {
                x: pos.x * this.getStageWidth(),
                y: pos.y * this.getStageHeight()
            };
        }
    }

    constrainPosition(x, y, padding = 0.002) {
        return {
            x: Math.min(Math.max(x, padding), 1 - padding),
            y: Math.min(Math.max(y, padding), 1 - padding)
        };
    }
}
