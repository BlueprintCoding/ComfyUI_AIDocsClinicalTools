import { app } from "../../../scripts/app.js";
import { SettingsPopup } from "./AIDocSharedClasses.js";

class MultiIntNode {
    constructor(node) {
        this.node = node;

        // Default properties
        if (typeof node.properties.activeCount !== "number") {
            node.properties.activeCount = 5;
        }
        if (typeof node.properties.intStep !== "number") {
            node.properties.intStep = 1;
        }
        if (!Array.isArray(node.properties.labels)) {
            node.properties.labels = [];
        }
        if (!Array.isArray(node.properties.values)) {
            node.properties.values = [];
        }
        this.adjustArrays();

        // Default node size
        if (!node.size) {
            node.size = [280, 200];
        }

        // Rect arrays for label, value, pencil, gear, increment, and decrement buttons
        this.labelRects = [];
        this.valueRects = [];
        this.pencilRects = [];
        this.incrementRects = [];
        this.decrementRects = [];
        this.gearRect = null;

        // Setup outputs/widgets
        this.setupOutputsAndWidgets();

        // Draw function
        node.onDrawForeground = this.onDrawForeground.bind(this);
    }

    
    setupOutputsAndWidgets() {
        this.node.outputs = [];
        this.node.widgets = [];
    
        for (let i = 0; i < this.node.properties.activeCount; i++) {
            // Create an INT output for each active slot
            this.node.addOutput("", "INT");
    
            // Create a hidden widget for each value
            const w = this.node.addWidget(
                "number",
                `value${i+1}`,
                this.node.properties.values[i],
                (val) => this.onValueChanged(i, val),
                { hidden: true }
            );
            w.computeSize = () => [0, -4];
            w.hidden = true;
        }
    
        // Rename outputs to i1..iN
        for (let i = 0; i < this.node.outputs.length; i++) {
            this.node.outputs[i].name = `i${i+1}`;
        }
    }
    
    onDrawForeground(ctx) {
        if (this.node.flags.collapsed) return;
    
        const margin = 8;
        const rowHeight = 30;
        const rowSpacing = margin;
        const count = this.node.properties.activeCount;
    
        // Compute node size
        let totalHeight = margin + (count * (rowHeight + rowSpacing)); 
        const MIN_WIDTH = 320;
        if (this.node.size[0] < MIN_WIDTH) {
            this.node.size[0] = MIN_WIDTH;
        }
        this.node.size[1] = totalHeight;
    
        // Draw node background (#181818)
        ctx.fillStyle = "#181818";
        ctx.fillRect(0, 0, this.node.size[0], this.node.size[1]);
    
        // Row backgrounds
        const rowBgWidth = this.node.size[0] - margin - 48; // Reserve space for outputs
        this.labelRects = [];
        this.valueRects = [];
        this.pencilRects = [];
        this.incrementRects = [];
        this.decrementRects = [];
    
        let y = margin;
        for (let i = 0; i < count; i++) {
            // Row background
            // Set the radius for the rounded corners
            const radius = 5;  // Adjust as needed
            // Row background with rounded corners
            ctx.fillStyle = "#444";
            ctx.beginPath();
            // Top-left corner
            ctx.moveTo(margin + radius, y);  
            ctx.arcTo(margin + rowBgWidth, y, margin + rowBgWidth, y + rowHeight, radius);  // Top-right corner
            // Bottom-right corner
            ctx.arcTo(margin + rowBgWidth, y + rowHeight, margin, y + rowHeight, radius);  // Bottom-right corner
            // Bottom-left corner
            ctx.arcTo(margin, y + rowHeight, margin, y, radius);  // Bottom-left corner
            // Top-left corner (to close the path)
            ctx.arcTo(margin, y, margin + rowBgWidth, y, radius);  // Top-left corner

            ctx.closePath();
            ctx.fill();
            // Static label (left) - e.g., i1, i2, i3, etc.
            ctx.fillStyle = "#7d7d7d";
            ctx.font = "12px Arial";
            ctx.textBaseline = "middle";
            ctx.textAlign = "left";
            const staticLabel = `·i${i + 1}`;
            const staticLabelMetrics = ctx.measureText(staticLabel);
            const staticLabelX = margin + 2;
            const staticLabelY = y + rowHeight / 2;
            ctx.fillText(staticLabel, staticLabelX, staticLabelY);

            // Draw the vertical line
            const lineStartX = staticLabelX + staticLabelMetrics.width + 4;  // Right of static label
            const lineStartY = staticLabelY - rowHeight / 2;  // Start from the middle of the static label
            const lineEndY = lineStartY + rowHeight;  // End after the row height (making the line same length as row)

            // Set the line color
            ctx.strokeStyle = "#7d7d7d";  // Same color as label for consistency
            ctx.lineWidth = 1;  // Line thickness

            ctx.beginPath();
            ctx.moveTo(lineStartX, lineStartY);  // Starting point of the line
            ctx.lineTo(lineStartX, lineEndY);    // Vertical line to the bottom of the row
            ctx.stroke();  // Actually draw the line

            // Custom label (right of static label) - e.g., INT 1, INT 2, etc.
            ctx.fillStyle = "#fff";
            ctx.font = "14px Arial";
            const customLabel = this.node.properties.labels[i] || `INT ${i + 1}`;
            const customLabelMetrics = ctx.measureText(customLabel);
            const customLabelX = staticLabelX + staticLabelMetrics.width + 10; // space between iN and INT N
            ctx.fillText(customLabel, customLabelX, staticLabelY);
            this.labelRects[i] = {
                x: customLabelX,
                y,
                w: customLabelMetrics.width + 8,
                h: rowHeight
            };


            // Value (middle)
            const val = this.node.properties.values[i] ?? 0;
            const valStr = val.toString();
            ctx.textAlign = "right";
            const valMetrics = ctx.measureText(valStr);
            const valX = margin + rowBgWidth - 90; // space for increment/decrement buttons and pencil
            const valY = y + rowHeight / 2;
            ctx.fillText(valStr, valX, valY);
            this.valueRects[i] = {
                x: valX - valMetrics.width - 4,
                y,
                w: valMetrics.width + 8,
                h: rowHeight
            };
    
            // Pencil icon
            ctx.textAlign = "left";
            ctx.fillStyle = "#ccc";
            ctx.font = "16px Arial";
            const pencilIcon = "✎";
            const pencilMetrics = ctx.measureText(pencilIcon);
            const pencilX = valX + 6;
            const pencilY = y + rowHeight / 2;
            ctx.fillText(pencilIcon, pencilX, pencilY);
            this.pencilRects[i] = {
                x: pencilX,
                y,
                w: pencilMetrics.width + 4,
                h: rowHeight
            };
    
            // Create a fixed-size rounded box for the increment (+) button
            const incrementButtonBoxX = valX + 36;  // Space for the box (positioned to the right of the value)
            const incrementButtonBoxY = y + (rowHeight / 4) - 2;
            const buttonBoxWidth = 20;     // Fixed width for the button box
            const buttonBoxHeight = 20;    // Fixed height for the button box

            // Set the background color for the increment button box
            ctx.fillStyle = "#4b3e72";  // Purple background
            ctx.beginPath();
            ctx.moveTo(incrementButtonBoxX + 5, incrementButtonBoxY); // Top-left corner
            ctx.arcTo(incrementButtonBoxX + buttonBoxWidth, incrementButtonBoxY, incrementButtonBoxX + buttonBoxWidth, incrementButtonBoxY + buttonBoxHeight, 5); // Top-right corner
            ctx.arcTo(incrementButtonBoxX + buttonBoxWidth, incrementButtonBoxY + buttonBoxHeight, incrementButtonBoxX, incrementButtonBoxY + buttonBoxHeight, 5); // Bottom-right corner
            ctx.arcTo(incrementButtonBoxX, incrementButtonBoxY + buttonBoxHeight, incrementButtonBoxX, incrementButtonBoxY, 5); // Bottom-left corner
            ctx.arcTo(incrementButtonBoxX, incrementButtonBoxY, incrementButtonBoxX + buttonBoxWidth, incrementButtonBoxY, 5); // Top-left corner
            ctx.closePath();
            ctx.fill();

            // Draw Increment Button (+)
            const incrementButton = "+";
            ctx.font = "12px Arial";  // Smaller font size for the button text
            ctx.fillStyle = "#fff"; // White color for the text inside the button
            ctx.fillText(incrementButton, incrementButtonBoxX + 6, incrementButtonBoxY + buttonBoxHeight / 2); // Draw + button in the middle

            // Create a fixed-size rounded box for the decrement (-) button
            const decrementButtonBoxX = incrementButtonBoxX + 24;  // Space for the box to the right of the + button
            const decrementButtonBoxY = incrementButtonBoxY;  // Same Y position as the + button box

            // Set the background color for the decrement button box
            ctx.fillStyle = "#4b3e72";  // Purple background
            ctx.beginPath();
            ctx.moveTo(decrementButtonBoxX + 5, decrementButtonBoxY); // Top-left corner
            ctx.arcTo(decrementButtonBoxX + buttonBoxWidth, decrementButtonBoxY, decrementButtonBoxX + buttonBoxWidth, decrementButtonBoxY + buttonBoxHeight, 5); // Top-right corner
            ctx.arcTo(decrementButtonBoxX + buttonBoxWidth, decrementButtonBoxY + buttonBoxHeight, decrementButtonBoxX, decrementButtonBoxY + buttonBoxHeight, 5); // Bottom-right corner
            ctx.arcTo(decrementButtonBoxX, decrementButtonBoxY + buttonBoxHeight, decrementButtonBoxX, decrementButtonBoxY, 5); // Bottom-left corner
            ctx.arcTo(decrementButtonBoxX, decrementButtonBoxY, decrementButtonBoxX + buttonBoxWidth, decrementButtonBoxY, 5); // Top-left corner
            ctx.closePath();
            ctx.fill();

            // Draw Decrement Button (-)
            const decrementButton = "-";
            ctx.font = "12px Arial";  // Smaller font size for the button text
            ctx.fillStyle = "#fff"; // White color for the text inside the button
            ctx.fillText(decrementButton, decrementButtonBoxX + 8, decrementButtonBoxY + buttonBoxHeight / 2); // Draw - button in the middle

            // Save button areas for interaction detection (with separate button box positions)
            this.incrementRects[i] = {
                x: incrementButtonBoxX,
                y: incrementButtonBoxY,
                w: buttonBoxWidth,
                h: buttonBoxHeight
            };

            this.decrementRects[i] = {
                x: decrementButtonBoxX,
                y: decrementButtonBoxY,
                w: buttonBoxWidth,
                h: buttonBoxHeight
            };

            y += rowHeight + rowSpacing;
            }
    
        // Gear icon at bottom-right
        const gearIcon = "⚙️";
        ctx.font = "18px Arial";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = "#ccc";
        const gearWidth = ctx.measureText(gearIcon).width;
        const gearHeight = 18;
        const gearX = this.node.size[0] - margin - (gearWidth / 2);
        const gearY = this.node.size[1] - margin - (gearHeight / 2);
        ctx.fillText(gearIcon, gearX, gearY);
    
        this.gearRect = {
            x: gearX - gearWidth / 2,
            y: gearY - gearHeight / 2,
            w: gearWidth,
            h: gearHeight
        };
    }
    
    

    onMouseDown(e, pos) {
        // Check pencil icons
        for (let i = 0; i < this.pencilRects.length; i++) {
            const r = this.pencilRects[i];
            if (!r) continue;
            if (pos[0] >= r.x && pos[0] <= r.x + r.w &&
                pos[1] >= r.y && pos[1] <= r.y + r.h) {
                console.log("Pencil clicked row:", i);
                const centerX = r.x + (r.w / 2);
                const centerY = r.y + (r.h / 2);
                this.showInlineIntEditor(i, { x: centerX, y: centerY, w: 80, h: 24 }, e);
                return true;
            }
        }

        // Check for custom label click to edit it
        for (let i = 0; i < this.labelRects.length; i++) {
            const r = this.labelRects[i];
            if (!r) continue;
            if (pos[0] >= r.x && pos[0] <= r.x + r.w &&
                pos[1] >= r.y && pos[1] <= r.y + r.h) {
                console.log("Label clicked row:", i);
                const centerX = r.x + (r.w / 2);
                const centerY = r.y + (r.h / 2);
                this.showInlineLabelEditor(i, { x: centerX, y: centerY, w: 80, h: 24 }, e);
                return true;
            }
        }


        // Check increment buttons
        for (let i = 0; i < this.incrementRects.length; i++) {
            const r = this.incrementRects[i];
            if (pos[0] >= r.x && pos[0] <= r.x + r.w &&
                pos[1] >= r.y && pos[1] <= r.y + r.h) {
                console.log("Increment button clicked row:", i);
                this.incrementValue(i);
                return true;
            }
        }

        // Check decrement buttons
        for (let i = 0; i < this.decrementRects.length; i++) {
            const r = this.decrementRects[i];
            if (pos[0] >= r.x && pos[0] <= r.x + r.w &&
                pos[1] >= r.y && pos[1] <= r.y + r.h) {
                console.log("Decrement button clicked row:", i);
                this.decrementValue(i);
                return true;
            }
        }

        // Check gear icon
        if (this.gearRect) {
            const r = this.gearRect;
            if (pos[0] >= r.x && pos[0] <= r.x + r.w &&
                pos[1] >= r.y && pos[1] <= r.y + r.h) {
                console.log("Gear icon clicked");
                this.openGearPopup(e);
                return true;
            }
        }

        return false;
    }

    showInlineLabelEditor(index, rect, e) {
        e.preventDefault();
        e.stopPropagation();
    
        const graphCanvas = app.graphcanvas;
        if (!graphCanvas) {
            console.warn("No graphCanvas found, using fallback coords.");
            const fallbackX = e.clientX - (rect.w * 0.5);
            const fallbackY = e.clientY - (rect.h * 0.5);
            return this.spawnInlineLabelEditorAtScreenPos(index, fallbackX, fallbackY, rect);
        }
    
        const nodeX = this.node.pos[0];
        const nodeY = this.node.pos[1];
        const localX = rect.x + (rect.w * 0.5);
        const localY = rect.y + (rect.h * 0.5);
        const scale = graphCanvas.ds.scale;
        const offset = graphCanvas.ds.offset;
        const canvasX = (nodeX + localX) * scale + offset[0];
        const canvasY = (nodeY + localY) * scale + offset[1];
        const canvasRect = graphCanvas.canvas.getBoundingClientRect();
        const screenX = canvasRect.left + canvasX;
        const screenY = canvasRect.top + canvasY;
    
        this.spawnInlineLabelEditorAtScreenPos(index, screenX, screenY, rect);
    }
    
    spawnInlineLabelEditorAtScreenPos(index, screenX, screenY, rect) {
        const input = document.createElement("input");
        input.type = "text";
        input.value = this.node.properties.labels[index] || `INT ${index + 1}`;
    
        input.style.position = "fixed";
        const offsetX = -(rect.w * 0.5);
        const offsetY = -(rect.h * 0.5);
        const FixedOffsetX = 35;
        const FixedOffsetY = 10;
        input.style.left = (screenX + offsetX + FixedOffsetX) + "px";
        input.style.top = (screenY + offsetY + FixedOffsetY) + "px";
        input.style.width = Math.max(rect.w, 250) + "px";
        input.style.height = Math.max(rect.h, 30) + "px";
    
        input.style.fontSize = "14px";
        input.style.zIndex = "10000";
        input.style.background = "#181818";
        input.style.color = "#fff";
        input.style.border = "2px solid #4b3e72";
        input.style.borderRadius = "6px";
        input.style.outline = "none";
        input.style.padding = "0 6px";
    
        document.body.appendChild(input);
    
        setTimeout(() => {
            input.focus();
            input.select();
        }, 10);
    
        const commit = () => {
            const val = input.value.trim();
            if (val.length > 0) {
                this.node.properties.labels[index] = val;
                this.node.setDirtyCanvas(true, true);
            }
            remove();
        };
    
        const remove = () => {
            document.removeEventListener("click", outsideClick, true);
            if (input.parentNode) {
                input.parentNode.removeChild(input);
            }
        };
    
        const outsideClick = (evt) => {
            if (evt.target !== input) {
                commit();
            }
        };
    
        setTimeout(() => {
            document.addEventListener("click", outsideClick, true);
        }, 100);
    
        input.addEventListener("keydown", (evt) => {
            if (evt.key === "Enter") {
                evt.preventDefault();
                commit();
            } else if (evt.key === "Escape") {
                evt.preventDefault();
                remove();
            }
        });
    }
    

    openGearPopup(e) {
        e.stopPropagation();
        let nodeElem = this.node.htmlElement;
        if (!nodeElem) {
            console.warn("No node.htmlElement, using fallback coords.");
            this.createGearPopupFallback(e.clientX, e.clientY);
            return;
        }
        const nodeRect = nodeElem.getBoundingClientRect();
        const popupX = nodeRect.left + 10;
        const popupY = nodeRect.top + 10;
    
        const popup = new SettingsPopup(this.node);
        popup.open(popupX, popupY);
        this.populateGearPopup(popup);  // <-- same logic
    }

    populateGearPopup(popup) {
        const content = popup.getContentContainer();
        popup.clearContent(); // no stale content
    
        // "Add/Remove Ints" label
        const addRemoveLabel = document.createElement("div");
        addRemoveLabel.textContent = "Add/Remove Ints";
        addRemoveLabel.style.color = "#fff";
        addRemoveLabel.style.fontSize = "12px";
        addRemoveLabel.style.textAlign = "center";
        content.appendChild(addRemoveLabel);
    
        // Button row
        const buttonRow = document.createElement("div");
        buttonRow.style.display = "flex";
        buttonRow.style.justifyContent = "center"; // Centering buttons
        buttonRow.style.alignItems = "center";
        buttonRow.style.width = "100%";
        buttonRow.style.gap = "10px";  // Reduced space between the buttons
        content.appendChild(buttonRow);
    
        const minusBtn = document.createElement("button");
        minusBtn.textContent = "-";
        minusBtn.style.background = "#333";
        minusBtn.style.color = "#fff";
        minusBtn.style.padding = "3px 10px";  // Set fixed padding for size consistency
        minusBtn.style.fontSize = "16px";
        buttonRow.appendChild(minusBtn);
    
        const plusBtn = document.createElement("button");
        plusBtn.textContent = "+";
        plusBtn.style.background = "#333";
        plusBtn.style.color = "#fff";
        plusBtn.style.padding = "3px 6px";  // Set fixed padding for size consistency
        plusBtn.style.fontSize = "16px";
        buttonRow.appendChild(plusBtn);
    
        // Steps label
        const stepsLabel = document.createElement("div");
        stepsLabel.textContent = "Steps";
        stepsLabel.style.color = "#fff";
        stepsLabel.style.fontSize = "12px";
        stepsLabel.style.textAlign = "center";
        content.appendChild(stepsLabel);
    
        // Steps input
        const stepsInput = document.createElement("input");
        stepsInput.type = "number";
        stepsInput.value = this.node.properties.intStep.toString();
        stepsInput.min = "1";
        stepsInput.step = "1";
        stepsInput.style.background = "#333";
        stepsInput.style.color = "#fff";
        content.appendChild(stepsInput);
    
        // Steps input change
        stepsInput.addEventListener("change", () => {
            const val = parseInt(stepsInput.value, 10);
            if (!isNaN(val) && val >= 1) {
                this.node.properties.intStep = val;
            } else {
                stepsInput.value = this.node.properties.intStep.toString();
            }
        });
    
        // minus logic
        minusBtn.addEventListener("click", (evt) => {
            evt.stopPropagation();
            
            // Save current width
            const currentWidth = this.node.size[0];
    
            if (this.node.properties.activeCount > 1) {
                this.node.properties.activeCount = Math.max(1, this.node.properties.activeCount - 1);
                this.adjustArrays();
                this.setupOutputsAndWidgets();
                this.node.setDirtyCanvas(true, true);
                
                // Reset width after updating active count
                this.node.size[0] = currentWidth;
                this.node.setDirtyCanvas(true, true);
                setTimeout(() => popup.reposition(this.node.htmlElement, 10, 10), 50);
            }
        });
    
        // plus logic
        plusBtn.addEventListener("click", (evt) => {
            evt.stopPropagation();
    
            // Save current width
            const currentWidth = this.node.size[0];
    
            if (this.node.properties.activeCount < 20) {
                this.node.properties.activeCount = Math.min(20, this.node.properties.activeCount + 1);
                this.adjustArrays();
                this.setupOutputsAndWidgets();
                this.node.setDirtyCanvas(true, true);
    
                // Reset width after updating active count
                this.node.size[0] = currentWidth;
                this.node.setDirtyCanvas(true, true);
                setTimeout(() => popup.reposition(this.node.htmlElement, 10, 10), 50);
            }
        });
    }
    
    createGearPopupFallback(x, y) {
        const popup = new SettingsPopup(this.node);
        popup.open(x, y);
        this.populateGearPopup(popup);  // <-- same logic again
    }

    showInlineIntEditor(index, rect, e) {
        e.preventDefault();
        e.stopPropagation();

        const graphCanvas = app.graphcanvas;
        if (!graphCanvas) {
            console.warn("No graphCanvas found, using fallback coords.");
            const fallbackX = e.clientX - (rect.w * 0.5);
            const fallbackY = e.clientY - (rect.h * 0.5);
            return this.spawnInlineEditorAtScreenPos(index, fallbackX, fallbackY, rect);
        }

        const nodeX = this.node.pos[0];
        const nodeY = this.node.pos[1];
        const localX = rect.x + (rect.w * 0.5);
        const localY = rect.y + (rect.h * 0.5);
        const scale = graphCanvas.ds.scale;
        const offset = graphCanvas.ds.offset;
        const canvasX = (nodeX + localX) * scale + offset[0];
        const canvasY = (nodeY + localY) * scale + offset[1];
        const canvasRect = graphCanvas.canvas.getBoundingClientRect();
        const screenX = canvasRect.left + canvasX;
        const screenY = canvasRect.top + canvasY;

        this.spawnInlineEditorAtScreenPos(index, screenX, screenY, rect);
    }

    spawnInlineEditorAtScreenPos(index, screenX, screenY, rect) {
        const input = document.createElement("input");
        input.type = "text";
        input.value = this.node.properties.values[index].toString();

        input.style.position = "fixed";
        const offsetX = -(rect.w * 0.5);
        const offsetY = -(rect.h * 0.5);
        const FixedOffsetX = 25;
        const FixedOffsetY = 10;
        input.style.left = (screenX + offsetX + FixedOffsetX) + "px";
        input.style.top = (screenY + offsetY + FixedOffsetY) + "px";
        input.style.width = Math.max(rect.w, 60) + "px";
        input.style.height = Math.max(rect.h, 24) + "px";

        input.style.fontSize = "14px";
        input.style.zIndex = "10000";
        input.style.background = "#181818";
        input.style.color = "#fff";
        input.style.border = "2px solid #4b3e72";
        input.style.borderRadius = "6px";
        input.style.outline = "none";
        input.style.padding = "0 6px";

        document.body.appendChild(input);

        setTimeout(() => {
            input.focus();
            input.select();
        }, 10);

        const commit = () => {
            const val = parseInt(input.value, 10);
            if (!isNaN(val)) {
                this.node.properties.values[index] = val;
                if (this.node.widgets[index]) {
                    this.node.widgets[index].value = val;
                }
                this.node.setDirtyCanvas(true, true);
            }
            remove();
        };

        const remove = () => {
            document.removeEventListener("click", outsideClick, true);
            if (input.parentNode) {
                input.parentNode.removeChild(input);
            }
        };

        const outsideClick = (evt) => {
            if (evt.target !== input) {
                commit();
            }
        };

        setTimeout(() => {
            document.addEventListener("click", outsideClick, true);
        }, 100);

        input.addEventListener("keydown", (evt) => {
            if (evt.key === "Enter") {
                evt.preventDefault();
                commit();
            } else if (evt.key === "Escape") {
                evt.preventDefault();
                remove();
            }
        });
    }

    onValueChanged(index, val) {
        this.node.properties.values[index] = parseInt(val, 10) || 0;
        this.node.setDirtyCanvas(true, true);
    }

    incrementValue(index) {
        const step = this.node.properties.intStep || 1;
        // Increase the value at the given index
        this.node.properties.values[index] += step;
        
        // Update the corresponding widget (so it gets updated on UI as well)
        if (this.node.widgets[index]) {
            this.node.widgets[index].value = this.node.properties.values[index];
        }
        
        // Mark the canvas as dirty so it gets redrawn with the new value
        this.node.setDirtyCanvas(true, true);
    }
    
    decrementValue(index) {
        const step = this.node.properties.intStep || 1;
        // Decrease the value at the given index
        this.node.properties.values[index] -= step;
        
        // Update the corresponding widget (so it gets updated on UI as well)
        if (this.node.widgets[index]) {
            this.node.widgets[index].value = this.node.properties.values[index];
        }
        
        // Mark the canvas as dirty so it gets redrawn with the new value
        this.node.setDirtyCanvas(true, true);
    }
    

    onValueChanged(index, val) {
        this.node.properties.values[index] = parseInt(val, 10) || 0;
        this.node.setDirtyCanvas(true, true);
    }

    adjustArrays() {
        const count = this.node.properties.activeCount;
        while (this.node.properties.labels.length < count) {
            this.node.properties.labels.push(`i${this.node.properties.labels.length + 1}`);
        }
        this.node.properties.labels.length = count;
        while (this.node.properties.values.length < count) {
            this.node.properties.values.push(0);
        }
        this.node.properties.values.length = count;
    }

}

app.registerExtension({
    name: "AIDocsClinicalTools.MultiInt",
    async beforeRegisterNodeDef(nodeType, nodeData, appInstance) {
        if (nodeData.name === "MultiInt") {
            Object.assign(nodeType.prototype, {
                onNodeCreated() {
                    this.multiIntNode = new MultiIntNode(this);
                },
                onMouseDown(e, pos) {
                    return this.multiIntNode.onMouseDown(e, pos);
                }
            });
        }
    }
});
