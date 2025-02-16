import { app } from "../../../scripts/app.js";
import { SettingsPopup } from "./AIDocSharedClasses.js";

function calculateLuminance(hexColor) {
    // Remove the hash at the start if it's there
    hexColor = hexColor.replace(/^#/, '');

    // Parse RGB components
    const r = parseInt(hexColor.substring(0, 2), 16) / 255;
    const g = parseInt(hexColor.substring(2, 4), 16) / 255;
    const b = parseInt(hexColor.substring(4, 6), 16) / 255;

    // Convert to luminance based on sRGB formula
    const a = [r, g, b].map(function (x) {
        return (x <= 0.03928) ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
    });

    // Return luminance (perceived brightness)
    return (a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722);
}

function getTextColorForBackground(bgColor) {
    const luminance = calculateLuminance(bgColor);

    // If luminance is less than 0.5, use white text (light text for dark backgrounds)
    return luminance < 0.5 ? '#ffffff' : '#000000';  // White for dark background, black for light
}

class MultiIntNode {
    constructor(node) {
        this.node = node;

        // Default properties
        if (typeof node.properties.activeCount !== "number") {
            node.properties.activeCount = 5;
        }
        // We'll use an array for per–row step values.
        if (!Array.isArray(node.properties.intSteps)) {
            node.properties.intSteps = [];
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
    
        // Use the color stored in bgColor, or fallback to the default color
        const bgColor = this.node.properties.bgColor || "#181818";  // Default color
        ctx.fillStyle = bgColor;

        // Draw a background with rounded bottom corners
        const radius = 8;  // Adjust the radius to control the roundness of the corners
        ctx.beginPath();
        // Top-left corner
        ctx.moveTo(0, 0); 
        ctx.lineTo(this.node.size[0], 0); // Top edge
        ctx.lineTo(this.node.size[0], this.node.size[1] - radius); // Right edge (top to bottom, leaving space for bottom rounded corner)
        ctx.arcTo(this.node.size[0], this.node.size[1], this.node.size[0] - radius, this.node.size[1], radius); // Bottom-right corner
        ctx.lineTo(radius, this.node.size[1]);  // Bottom edge (right to left)
        ctx.arcTo(0, this.node.size[1], 0, this.node.size[1] - radius, radius); // Bottom-left corner
        ctx.lineTo(0, radius); // Left edge (bottom to top)
        ctx.closePath();
        ctx.fill();

        // Row backgrounds
        const rowBgWidth = this.node.size[0] - margin - 38; // Reserve space for outputs
        this.labelRects = [];
        this.valueRects = [];
        this.pencilRects = [];
        this.incrementRects = [];
        this.decrementRects = [];

        const rowBgColor = this.node.properties.rowBgColor || "#121212";
        const rowTextColor = getTextColorForBackground(rowBgColor) || '#fff';
    
        let y = margin;
        for (let i = 0; i < count; i++) {
            // Row background
            // Set the radius for the rounded corners
            const radius = 5;  // Adjust as needed
            // Row background with rounded corners
            ctx.fillStyle = rowBgColor;
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
            ctx.fillStyle = rowTextColor;
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
            ctx.strokeStyle = rowTextColor;  // Same color as label for consistency
            ctx.lineWidth = 1;  // Line thickness

            ctx.beginPath();
            ctx.moveTo(lineStartX, lineStartY);  // Starting point of the line
            ctx.lineTo(lineStartX, lineEndY);    // Vertical line to the bottom of the row
            ctx.stroke();  // Actually draw the line

            // Custom label (right of static label) - e.g., INT 1, INT 2, etc.
            ctx.fillStyle = rowTextColor;
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
            ctx.fillStyle = rowTextColor;
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

            const incDecColor = this.node.properties.buttonColor || "#4b3e72";  // Default color
            const textColor = getTextColorForBackground(incDecColor);  // Get text color based on the background

            // Set the background color for the increment button box
            ctx.fillStyle = incDecColor;  // Purple background
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
            ctx.fillStyle = textColor; // White color for the text inside the button
            ctx.fillText(incrementButton, incrementButtonBoxX + 6, incrementButtonBoxY + buttonBoxHeight / 2); // Draw + button in the middle

            // Create a fixed-size rounded box for the decrement (-) button
            const decrementButtonBoxX = incrementButtonBoxX + 24;  // Space for the box to the right of the + button
            const decrementButtonBoxY = incrementButtonBoxY;  // Same Y position as the + button box

            // Set the background color for the decrement button box
            ctx.fillStyle = incDecColor;  // Purple background
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
            ctx.fillStyle = textColor; // White color for the text inside the button
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
    
    startValueDragToggle(index, initialEvent) {
        // If already dragging, then stop dragging (commit the value)
        if (this.dragActive) {
          this.stopValueDrag();
          return;
        }
        
        // Start drag mode for this value.
        this.dragActive = true;
        this.dragIndex = index;
        this.dragInitialX = initialEvent.clientX;
        this.dragInitialValue = this.node.properties.values[index];
        const step = (this.node.properties.intSteps && this.node.properties.intSteps[index]) || 1;
        const sensitivity = 10; // pixels per step change
        
        // Get the canvas element.
        const canvasEl = document.getElementById("graph-canvas");
        if (!canvasEl) return;
        
        // Define a pointermove handler to update the value as the pointer moves.
        this._onValuePointerMove = (e) => {
          const dx = e.clientX - this.dragInitialX;
          const steps = Math.floor(dx / sensitivity);
          const newValue = this.dragInitialValue + steps * step;
          if (newValue !== this.node.properties.values[this.dragIndex]) {
            this.node.properties.values[this.dragIndex] = newValue;
            if (this.node.widgets[this.dragIndex]) {
              this.node.widgets[this.dragIndex].value = newValue;
            }
            this.node.setDirtyCanvas(true, true);
          }
        };
        
        // Attach the pointermove handler to the canvas.
        canvasEl.addEventListener("pointermove", this._onValuePointerMove);
        
        // Define a global click handler to stop the drag.
        this._onGlobalClickToStop = (e) => {
          // Prevent this click from re-triggering startValueDragToggle immediately.
          console.log("Global click detected—stopping drag");
          this.stopValueDrag();
        };
        // Attach the global click handler with capture so it fires before other click handlers.
        document.addEventListener("click", this._onGlobalClickToStop, { capture: true });
        
        // Also attach a keydown handler on the document so that Enter stop drag mode.
        this._onKeyDownToStop = (e) => {
          if (e.key === "Enter") {
            console.log("Keydown (" + e.key + ") detected—stopping drag");
            this.stopValueDrag();
          }
        };
        document.addEventListener("keydown", this._onKeyDownToStop);
      }
      
      stopValueDrag() {
        const canvasEl = document.getElementById("graph-canvas");
        if (!canvasEl) return;
        
        if (this._onValuePointerMove) {
          canvasEl.removeEventListener("pointermove", this._onValuePointerMove);
          this._onValuePointerMove = null;
        }
        if (this._onGlobalClickToStop) {
          document.removeEventListener("click", this._onGlobalClickToStop, { capture: true });
          this._onGlobalClickToStop = null;
        }
        if (this._onKeyDownToStop) {
          document.removeEventListener("keydown", this._onKeyDownToStop);
          this._onKeyDownToStop = null;
        }
        this.dragActive = false;
        this.dragIndex = null;
        this.node.setDirtyCanvas(true, true);
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

        // Check if the click is in a value rectangle and start drag-to-change behavior
        // Then, check if the click is in a value rectangle:
        for (let i = 0; i < this.valueRects.length; i++) {
            const r = this.valueRects[i];
            if (r && pos[0] >= r.x && pos[0] <= r.x + r.w &&
                pos[1] >= r.y && pos[1] <= r.y + r.h) {
              // Toggle drag mode on the value at index i.
              this.startValueDragToggle(i, e);
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

 // ----------------- Gear Popup: Node Settings -----------------
 populateGearPopup(popup) {
    const content = popup.getContentContainer();
    popup.clearContent();

    // Apply max height, vertical scroll, and thin scrollbar to content
    content.style.maxHeight = "300px";
    content.style.overflowY = "auto";
    content.style.scrollbarWidth = "thin";  // Firefox: Thin scrollbar
    content.style.setProperty("::-webkit-scrollbar", "width: 6px; height: 6px;");
    content.style.setProperty("::-webkit-scrollbar-thumb", "background-color: #4b3e72; border-radius: 10px;");
    content.style.setProperty("::-webkit-scrollbar-track", "background-color: #181818; border-radius: 10px;");

    // "Add/Remove Ints" label and buttons (existing code)
    const addRemoveLabel = document.createElement("div");
    addRemoveLabel.textContent = "Add/Remove Ints";
    addRemoveLabel.style.color = "#fff";
    addRemoveLabel.style.fontSize = "12px";
    addRemoveLabel.style.textAlign = "center";
    content.appendChild(addRemoveLabel);

    const buttonRow = document.createElement("div");
    buttonRow.style.display = "flex";
    buttonRow.style.justifyContent = "center";
    buttonRow.style.alignItems = "center";
    buttonRow.style.width = "100%";
    buttonRow.style.gap = "10px";
    buttonRow.style.marginTop = "-5px";
    content.appendChild(buttonRow);

    const minusBtn = document.createElement("button");
    minusBtn.textContent = "-";
    minusBtn.style.background = "#333";
    minusBtn.style.color = "#fff";
    minusBtn.style.padding = "0px 12px";
    minusBtn.style.fontSize = "16px";
    buttonRow.appendChild(minusBtn);

    const plusBtn = document.createElement("button");
    plusBtn.textContent = "+";
    plusBtn.style.background = "#333";
    plusBtn.style.color = "#fff";
    plusBtn.style.padding = "0px 8px";
    plusBtn.style.fontSize = "16px";
    buttonRow.appendChild(plusBtn);

    const stepsLabel = document.createElement("div");
    stepsLabel.textContent = "Steps";
    stepsLabel.style.color = "#fff";
    stepsLabel.style.fontSize = "12px";
    stepsLabel.style.textAlign = "center";
    content.appendChild(stepsLabel);

    // Create a container for the steps input
    const stepsContainer = document.createElement("div");
    stepsContainer.style.cssText = `
        margin-top:-5px;
        background: #131313;
        padding-top: 5px;
        padding-bottom: 5px;
        min-height: 100px;
        width: 95%;
        overflow-y: auto;
        scrollbar-width: thin;
    `;
    stepsContainer.style.setProperty("::-webkit-scrollbar", "width: 6px; height: 6px;");
    stepsContainer.style.setProperty("::-webkit-scrollbar-thumb", "background-color: #4b3e72; border-radius: 10px;");
    stepsContainer.style.setProperty("::-webkit-scrollbar-track", "background-color: #181818; border-radius: 10px;");
    content.appendChild(stepsContainer);



    const stepsList = document.createElement("div");
    stepsContainer.appendChild(stepsList);

    // Update the steps inputs based on activeCount
    const updateStepInputs = () => {
        // Clear existing steps
        stepsList.innerHTML = '';

        // Add the step inputs based on activeCount
        for (let i = 0; i < this.node.properties.activeCount; i++) {
            const stepDiv = document.createElement("div");
            stepDiv.style.display = "flex";
            stepDiv.style.justifyContent = "center";
            stepDiv.style.marginBottom = "5px";
            stepDiv.style.paddingBottom = "2px";
            stepDiv.style.borderBottom = "2px solid #262626";

            const intLabel = document.createElement("span");
            intLabel.textContent = `i${i + 1}`;
            intLabel.style.color = "#fff";
            intLabel.style.fontSize = "14px";
            intLabel.style.marginRight = "2px";
            intLabel.style.marginTop = "2px";

            const stepInput = document.createElement("input");
            stepInput.type = "number";
            stepInput.value = this.node.properties.intSteps[i] || 1;
            stepInput.min = "1";
            stepInput.style.width = "60px";
            stepInput.style.fontSize = "12px";
            stepInput.style.background = "#333";
            stepInput.style.color = "#fff";
            stepInput.style.border = "2px solid #4b3e72";
            stepInput.style.borderRadius = "6px";
            stepInput.style.textAlign = "center";

            stepInput.addEventListener("change", () => {
                const newStep = parseInt(stepInput.value, 10);
                if (!isNaN(newStep) && newStep >= 1) {
                    this.node.properties.intSteps[i] = newStep;
                } else {
                    stepInput.value = this.node.properties.intSteps[i] || 1;
                }
            });

            stepDiv.appendChild(intLabel);
            stepDiv.appendChild(stepInput);
            stepsList.appendChild(stepDiv);
        }
    };

    // Initial update of step inputs
    updateStepInputs();

    // ---------------------------- Node Background Color Picker ----------------------------
    const bgColorLabel = document.createElement("div");
    bgColorLabel.textContent = "Node Background Color";
    bgColorLabel.style.color = "#fff";
    bgColorLabel.style.fontSize = "12px";
    bgColorLabel.style.textAlign = "center";
    content.appendChild(bgColorLabel);

    const colorPicker = document.createElement("input");
    colorPicker.type = "color";
    colorPicker.value = this.node.properties.bgColor || "#181818"; 
    colorPicker.style.marginTop = "-5px";
    colorPicker.style.minHeight = "25px"; // This ensures a minimum height
    colorPicker.style.width = "100%";
    colorPicker.style.marginBottom = "0px";
    content.appendChild(colorPicker);

    colorPicker.addEventListener("input", (e) => {
        const selectedColor = e.target.value;
        this.node.properties.bgColor = selectedColor;  
        this.node.setDirtyCanvas(true, true);  
    });

    // ---------------------------- Row Background Color Picker ----------------------------

    const rowBgColorLabel = document.createElement("div");
    rowBgColorLabel.textContent = "Row Background Color";
    rowBgColorLabel.style.color = "#fff";
    rowBgColorLabel.style.fontSize = "12px";
    rowBgColorLabel.style.textAlign = "center";
    content.appendChild(rowBgColorLabel);

    const rowBgColorPicker = document.createElement("input");
    rowBgColorPicker.type = "color";
    rowBgColorPicker.value = this.node.properties.rowBgColor || "#121212"; 
    rowBgColorPicker.style.marginTop = "-5px";
    rowBgColorPicker.style.minHeight = "25px"; // This ensures a minimum height
    rowBgColorPicker.style.width = "100%";
    rowBgColorPicker.style.marginBottom = "0px";
    content.appendChild(rowBgColorPicker);

    rowBgColorPicker.addEventListener("input", (e) => {
        const selectedColor = e.target.value;
        this.node.properties.rowBgColor = selectedColor;
        this.node.setDirtyCanvas(true, true);  
    });

    // ---------------------------- Increment/Decrement Button Color Picker ----------------------------

    const buttonColorLabel = document.createElement("div");
    buttonColorLabel.textContent = "Int +/- Button Color";
    buttonColorLabel.style.color = "#fff";
    buttonColorLabel.style.fontSize = "12px";
    buttonColorLabel.style.textAlign = "center";
    content.appendChild(buttonColorLabel);

    const buttonColorPicker = document.createElement("input");
    buttonColorPicker.type = "color";
    buttonColorPicker.value = this.node.properties.buttonColor || "#4b3e72"; 
    buttonColorPicker.style.marginTop = "-5px";
    buttonColorPicker.style.minHeight = "25px"; // This ensures a minimum height
    buttonColorPicker.style.width = "100%";
    buttonColorPicker.style.marginBottom = "0px";
    content.appendChild(buttonColorPicker);

    buttonColorPicker.addEventListener("input", (e) => {
        const selectedButtonColor = e.target.value;
        this.node.properties.buttonColor = selectedButtonColor;  
        this.node.setDirtyCanvas(true, true);  
    });

    // minus logic
    minusBtn.addEventListener("click", (evt) => {
        evt.stopPropagation();
        const currentWidth = this.node.size[0];

        if (this.node.properties.activeCount > 1) {
            this.node.properties.activeCount = Math.max(1, this.node.properties.activeCount - 1);
            this.adjustArrays();  // Update intSteps and other arrays
            updateStepInputs();  // Update the step inputs in the UI
            this.node.setDirtyCanvas(true, true);

            this.node.size[0] = currentWidth;
            this.node.setDirtyCanvas(true, true);
            setTimeout(() => popup.reposition(this.node.htmlElement, 10, 10), 50);
        }
    });

    // plus logic
    plusBtn.addEventListener("click", (evt) => {
        evt.stopPropagation();
        const currentWidth = this.node.size[0];

        if (this.node.properties.activeCount < 20) {
            this.node.properties.activeCount = Math.min(20, this.node.properties.activeCount + 1);
            this.adjustArrays();  // Update intSteps and other arrays
            updateStepInputs();  // Update the step inputs in the UI
            this.node.setDirtyCanvas(true, true);

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
        // Use per–row step value.
        const step = (this.node.properties.intSteps && this.node.properties.intSteps[index]) || 1;
        this.node.properties.values[index] += step;
        if (this.node.widgets[index]) {
          this.node.widgets[index].value = this.node.properties.values[index];
        }
        this.node.setDirtyCanvas(true, true);
      }
      
      decrementValue(index) {
        const step = (this.node.properties.intSteps && this.node.properties.intSteps[index]) || 1;
        this.node.properties.values[index] -= step;
        if (this.node.widgets[index]) {
          this.node.widgets[index].value = this.node.properties.values[index];
        }
        this.node.setDirtyCanvas(true, true);
      }
    // Ensure that labels, values, and intSteps arrays have exactly activeCount elements.
    adjustArrays() {
        const count = this.node.properties.activeCount;
    
        // Adjust labels
        while (this.node.properties.labels.length < count) {
            this.node.properties.labels.push(`i${this.node.properties.labels.length + 1}`);
        }
        this.node.properties.labels.length = count;
    
        // Adjust values
        while (this.node.properties.values.length < count) {
            this.node.properties.values.push(0);
        }
        this.node.properties.values.length = count;
    
        // Adjust intSteps
        while (this.node.properties.intSteps.length < count) {
            this.node.properties.intSteps.push(1);  // Default step value
        }
        this.node.properties.intSteps.length = count;
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
