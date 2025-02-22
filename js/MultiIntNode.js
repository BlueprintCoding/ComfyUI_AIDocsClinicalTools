import { app } from "../../../scripts/app.js";
import { SettingsPopup } from "./AIDocSharedClasses.js";

function calculateLuminance(hexColor) {
    hexColor = hexColor.replace(/^#/, '');
    const r = parseInt(hexColor.substring(0, 2), 16) / 255;
    const g = parseInt(hexColor.substring(2, 4), 16) / 255;
    const b = parseInt(hexColor.substring(4, 6), 16) / 255;
    const a = [r, g, b].map(function (x) {
        return (x <= 0.03928) ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
    });
    return (a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722);
}

function getTextColorForBackground(bgColor) {
    const luminance = calculateLuminance(bgColor);
    return luminance < 0.5 ? '#ffffff' : '#000000';
}

function truncateText(ctx, text, maxWidth) {
    const ellipsis = "...";
    const ellipsisWidth = ctx.measureText(ellipsis).width;
    if (ctx.measureText(text).width <= maxWidth) {
      return text;
    }
    let truncated = text;
    while (truncated && ctx.measureText(truncated).width + ellipsisWidth > maxWidth) {
      truncated = truncated.slice(0, -1);
    }
    return truncated + ellipsis;
}

class MultiIntNode {
    constructor(node) {
        this.node = node;
        if (typeof node.properties.activeCount !== "number") {
            node.properties.activeCount = 20;
        }
        if (!Array.isArray(node.properties.intSteps)) {
            node.properties.intSteps = [];
        }
        if (!Array.isArray(node.properties.labels)) {
            node.properties.labels = [];
        }
        if (!Array.isArray(node.properties.values)) {
            node.properties.values = [];
        }
        if (!Array.isArray(node.properties.intMin)) {
            node.properties.intMin = [];
        }
        if (!Array.isArray(node.properties.intMax)) {
            node.properties.intMax = [];
        }
        this.adjustArrays();

        for (let i = 0; i < this.node.properties.activeCount; i++) {
            const stepVal = this.node.properties.intSteps[i] || 1;

            if (typeof this.node.properties.intMin[i] === "number") {
                const oldMin = this.node.properties.intMin[i];
                const newMin = stepVal * Math.round(oldMin / stepVal);
                this.node.properties.intMin[i] = newMin;
            }
            if (typeof this.node.properties.intMax[i] === "number") {
                const oldMax = this.node.properties.intMax[i];
                const newMax = stepVal * Math.round(oldMax / stepVal);
                this.node.properties.intMax[i] = newMax;
            }
        }
    
        if (typeof node.properties.bottomPadding !== "number") {
            node.properties.bottomPadding = 0;
        }
        if (typeof node.properties.minWidth !== "number") {
            node.properties.minWidth = 250;
        }
        if (typeof node.properties.maxWidth !== "number") {
            node.properties.maxWidth = 1000;
        }
            // Add new boolean property for showing the static label & line
        if (typeof node.properties.showStaticLabelAndLine !== "boolean") {
            node.properties.showStaticLabelAndLine = true; // default: show
        }
        //group labels
        if (!Array.isArray(node.properties.groupLabels)) {
            node.properties.groupLabels = [];
        }
                

        this.labelRects = [];
        this.valueRects = [];
        this.pencilRects = [];
        this.incrementRects = [];
        this.decrementRects = [];
        this.gearRect = null;

        this.setupOutputsAndWidgets();
        node.setDirtyCanvas(true, true);
        node.onDrawForeground = this.onDrawForeground.bind(this);
    }

    setupOutputsAndWidgets() {
        const oldSize = [...this.node.size];
        this.node.outputs = [];
        this.node.widgets = [];
        for (let i = 0; i < this.node.properties.activeCount; i++) {
          this.node.addOutput("", "INT");
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
        for (let i = 0; i < this.node.outputs.length; i++) {
          this.node.outputs[i].name = `${i+1}`;
        }
        this.node.size[0] = oldSize[0];
    }

// CHANGED onDrawForeground + new drawGroupLabelRow

onDrawForeground(ctx) {
    if (this.node.flags.collapsed) return;
    if (this.node.outputs.length !== this.node.properties.activeCount) {
        this.node.outputs = [];
        this.node.widgets = [];
        this.setupOutputsAndWidgets();
        if (this.node.onOutputsChange) {
            this.node.onOutputsChange();
        }
    }

    const margin = 8;
    const rowSpacing = (typeof this.node.properties.rowSpacing === "number") ? this.node.properties.rowSpacing : margin;
    const rowHeight = 30;
    const count = this.node.properties.activeCount;
    const groupLabels = Array.isArray(this.node.properties.groupLabels) ? this.node.properties.groupLabels : [];
    const groupLabelHeight = 24;

    // Compute total needed height to factor in group labels as well
    // A simple approach is to add groupLabels.length * groupLabelHeight, plus rowSpacing for each group label
    // Then the float rows, plus bottom padding, etc. Or you can do it dynamically while drawing.
    // Here, we do a rough pass to count how many group labels exist:
    const neededHeight = margin
        + (count * (rowHeight + rowSpacing))
        + (groupLabels.length * (groupLabelHeight + rowSpacing))
        + (this.node.properties.bottomPadding || 0);
    this.node.size[1] = neededHeight;

    // Clamp width
    if (this.node.size[0] < this.node.properties.minWidth) {
        this.node.size[0] = this.node.properties.minWidth;
    }
    if (this.node.size[0] > this.node.properties.maxWidth) {
        this.node.size[0] = this.node.properties.maxWidth;
    }

    // Background
    const bgColor = this.node.properties.bgColor || "#181818";
    ctx.fillStyle = bgColor;
    const radius = 8;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(this.node.size[0], 0);
    ctx.lineTo(this.node.size[0], this.node.size[1] - radius);
    ctx.arcTo(this.node.size[0], this.node.size[1], this.node.size[0] - radius, this.node.size[1], radius);
    ctx.lineTo(radius, this.node.size[1]);
    ctx.arcTo(0, this.node.size[1], 0, this.node.size[1] - radius, radius);
    ctx.lineTo(0, radius);
    ctx.closePath();
    ctx.fill();

    const rowBgWidth = this.node.size[0] - margin - 38;
    const rowBgColor = this.node.properties.rowBgColor || "#121212";
    const rowTextColor = getTextColorForBackground(rowBgColor) || "#fff";

    this.labelRects = [];
    this.valueRects = [];
    this.pencilRects = [];
    this.incrementRects = [];
    this.decrementRects = [];

    let y = margin;

    // Draw rows and group labels
    for (let i = 0; i < count; i++) {
        // Check if we have group labels that appear BEFORE row i
        const labelsForThisRow = groupLabels.filter(lbl => lbl.beforeRow === i);
        for (const gLabel of labelsForThisRow) {
            y = this.drawGroupLabelRow(ctx, gLabel, margin, y, rowBgWidth);
        }

        // Draw the row background
        ctx.fillStyle = rowBgColor;
        ctx.beginPath();
        ctx.moveTo(margin + radius, y);
        ctx.arcTo(margin + rowBgWidth, y, margin + rowBgWidth, y + rowHeight, radius);
        ctx.arcTo(margin + rowBgWidth, y + rowHeight, margin, y + rowHeight, radius);
        ctx.arcTo(margin, y + rowHeight, margin, y, radius);
        ctx.arcTo(margin, y, margin + rowBgWidth, y, radius);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = rowTextColor;
        ctx.font = "12px Arial";
        ctx.textBaseline = "middle";
        ctx.textAlign = "left";

        const staticLabelY = y + rowHeight / 2;
        let lineStartX = margin + 2;

        if (this.node.properties.showStaticLabelAndLine) {
            const staticLabel = `·${i + 1}`;
            const staticLabelMetrics = ctx.measureText(staticLabel);
            const staticLabelX = margin + 2;
            ctx.fillText(staticLabel, staticLabelX, staticLabelY);
            lineStartX = staticLabelX + staticLabelMetrics.width + 4;
            ctx.beginPath();
            ctx.moveTo(lineStartX, staticLabelY - rowHeight / 2);
            ctx.lineTo(lineStartX, staticLabelY + rowHeight / 2);
            ctx.stroke();
        }

        const valX = margin + rowBgWidth - 90;
        const labelAreaStart = lineStartX + 6;
        const labelAreaEnd = valX - 80;
        let availableWidth = labelAreaEnd - labelAreaStart;
        if (availableWidth < 0) {
          availableWidth = 0;
        }

        const labelWidthRules = [
            { max: 10, set: 60 },
            { max: 15, set: 65 },
            { max: 30, set: 80 },
            { max: 50, set: 90 },
            { max: 70, set: 100 },
            { max: 90, set: 110 },
            { max: 150, multiplier: 1.2 },
            { max: 200, multiplier: 1.15 },
            { max: 400, multiplier: 0.98 },
            { max: 500, multiplier: 0.95 },
            { max: Infinity, multiplier: 0.93 }
        ];
        function adjustLabelWidth(width) {
            for (const rule of labelWidthRules) {
                if (width <= rule.max) {
                    if (rule.set !== undefined) {
                        return rule.set;
                    }
                    if (rule.multiplier !== undefined) {
                        return width * rule.multiplier;
                    }
                }
            }
            return width;
        }
        const customLabelRaw = this.node.properties.labels[i] || `INT ${i + 1}`;
        const adjustedWidth = adjustLabelWidth(availableWidth);
        const displayLabel = truncateText(ctx, customLabelRaw, adjustedWidth);
        ctx.font = "14px Arial";
        ctx.fillStyle = rowTextColor;
        ctx.fillText(displayLabel, labelAreaStart, staticLabelY);
        const displayedLabelWidth = ctx.measureText(displayLabel).width;
        this.labelRects[i] = { x: labelAreaStart, y, w: displayedLabelWidth + 8, h: rowHeight };

        const val = this.node.properties.values[i] ?? 0;
        const valStr = val.toString();
        ctx.textAlign = "right";
        ctx.font = "14px Arial";
        const valMetrics = ctx.measureText(valStr);
        ctx.fillText(valStr, valX, staticLabelY);
        this.valueRects[i] = {
            x: valX - valMetrics.width - 4,
            y,
            w: valMetrics.width + 8,
            h: rowHeight
        };

        ctx.textAlign = "left";
        ctx.font = "16px Arial";
        const pencilIcon = "✎";
        const pencilMetrics = ctx.measureText(pencilIcon);
        const pencilX = valX + 6;
        ctx.fillText(pencilIcon, pencilX, staticLabelY);
        this.pencilRects[i] = {
            x: pencilX,
            y,
            w: pencilMetrics.width + 4,
            h: rowHeight
        };

        const incDecColor = this.node.properties.buttonColor || "#4b3e72";
        const incDecTextColor = getTextColorForBackground(incDecColor);
        const decrementButtonBoxX = valX + 36;
        const decrementButtonBoxY = y + (rowHeight / 4) - 2;
        const buttonBoxWidth = 20;
        const buttonBoxHeight = 20;
        const incrementButtonBoxX = decrementButtonBoxX + 24;
        const incrementButtonBoxY = decrementButtonBoxY;

        // Decrement
        ctx.fillStyle = incDecColor;
        ctx.beginPath();
        ctx.moveTo(decrementButtonBoxX + 5, decrementButtonBoxY);
        ctx.arcTo(decrementButtonBoxX + buttonBoxWidth, decrementButtonBoxY, decrementButtonBoxX + buttonBoxWidth, decrementButtonBoxY + buttonBoxHeight, 5);
        ctx.arcTo(decrementButtonBoxX + buttonBoxWidth, decrementButtonBoxY + buttonBoxHeight, decrementButtonBoxX, decrementButtonBoxY + buttonBoxHeight, 5);
        ctx.arcTo(decrementButtonBoxX, decrementButtonBoxY + buttonBoxHeight, decrementButtonBoxX, decrementButtonBoxY, 5);
        ctx.arcTo(decrementButtonBoxX, decrementButtonBoxY, decrementButtonBoxX + buttonBoxWidth, decrementButtonBoxY, 5);
        ctx.closePath();
        ctx.fill();
        ctx.font = "12px Arial";
        ctx.fillStyle = incDecTextColor;
        ctx.fillText("-", decrementButtonBoxX + 8, decrementButtonBoxY + buttonBoxHeight / 2);
        this.decrementRects[i] = {
            x: decrementButtonBoxX,
            y: decrementButtonBoxY,
            w: buttonBoxWidth,
            h: buttonBoxHeight
        };

        // Increment
        ctx.fillStyle = incDecColor;
        ctx.beginPath();
        ctx.moveTo(incrementButtonBoxX + 5, incrementButtonBoxY);
        ctx.arcTo(incrementButtonBoxX + buttonBoxWidth, incrementButtonBoxY, incrementButtonBoxX + buttonBoxWidth, incrementButtonBoxY + buttonBoxHeight, 5);
        ctx.arcTo(incrementButtonBoxX + buttonBoxWidth, incrementButtonBoxY + buttonBoxHeight, incrementButtonBoxX, incrementButtonBoxY + buttonBoxHeight, 5);
        ctx.arcTo(incrementButtonBoxX, incrementButtonBoxY + buttonBoxHeight, incrementButtonBoxX, incrementButtonBoxY, 5);
        ctx.arcTo(incrementButtonBoxX, incrementButtonBoxY, incrementButtonBoxX + buttonBoxWidth, incrementButtonBoxY, 5);
        ctx.closePath();
        ctx.fill();
        ctx.font = "12px Arial";
        ctx.fillStyle = incDecTextColor;
        ctx.fillText("+", incrementButtonBoxX + 6, incrementButtonBoxY + buttonBoxHeight / 2);
        this.incrementRects[i] = {
            x: incrementButtonBoxX,
            y: incrementButtonBoxY,
            w: buttonBoxWidth,
            h: buttonBoxHeight
        };

        y += rowHeight + rowSpacing;
    }

    // Finally, any group labels after the last row
    const trailingLabels = groupLabels.filter(lbl => lbl.beforeRow >= count);
    for (const gLabel of trailingLabels) {
        y = this.drawGroupLabelRow(ctx, gLabel, margin, y, rowBgWidth);
    }

    // Gear icon
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

    // Bottom padding
    const bottomPad = parseInt(this.node.properties.bottomPadding, 10) || 0;
    if (bottomPad > 0) {
        ctx.fillStyle = bgColor;
        ctx.fillRect(margin + radius, y, rowBgWidth, bottomPad);
        y += bottomPad;
    }
}

drawGroupLabelRow(ctx, labelObj, margin, startY, rowBgWidth) {
    const rowHeight = 24;  // Adjust as needed
    const radius = 8;

    // Use the background color of the label, or default
    const bg = labelObj.bgColor || "#242424";
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.moveTo(margin + radius, startY);
    ctx.arcTo(margin + rowBgWidth, startY, margin + rowBgWidth, startY + rowHeight, radius);
    ctx.arcTo(margin + rowBgWidth, startY + rowHeight, margin, startY + rowHeight, radius);
    ctx.arcTo(margin, startY + rowHeight, margin, startY, radius);
    ctx.arcTo(margin, startY, margin + rowBgWidth, startY, radius);
    ctx.closePath();
    ctx.fill();

    // Text
    const textColor = getTextColorForBackground(bg);
    ctx.fillStyle = textColor;
    ctx.font = "16px Arial";
    ctx.textBaseline = "middle";
    ctx.textAlign = "left";
    const textX = margin + 10;
    const textY = startY + rowHeight / 2;
    ctx.fillText(labelObj.text || "Group Label", textX, textY);

    const rowSpacing = (typeof this.node.properties.rowSpacing === "number") ? this.node.properties.rowSpacing : 8;
    return startY + rowHeight + rowSpacing;
}

    clampValue(index, val) {
        const minVal = this.node.properties.intMin[index];
        const maxVal = this.node.properties.intMax[index];
        if (typeof minVal === "number" && val < minVal) {
            val = minVal;
        }
        if (typeof maxVal === "number" && val > maxVal) {
            val = maxVal;
        }
        return val;
    }

    startValueDragToggle(index, initialEvent) {
        if (this.dragActive) {
          this.stopValueDrag();
          return;
        }
        this.dragActive = true;
        this.dragIndex = index;
        this.dragInitialX = initialEvent.clientX;
        this.dragInitialValue = this.node.properties.values[index];
        const step = (this.node.properties.intSteps && this.node.properties.intSteps[index]) || 1;
        const sensitivity = 10;
        const canvasEl = document.getElementById("graph-canvas");
        if (!canvasEl) return;
        this._onValuePointerMove = (e) => {
          const dx = e.clientX - this.dragInitialX;
          const steps = Math.floor(dx / sensitivity);
          let newValue = this.dragInitialValue + steps * step;
          newValue = this.clampValue(index, newValue);
          if (newValue !== this.node.properties.values[this.dragIndex]) {
            this.node.properties.values[this.dragIndex] = newValue;
            if (this.node.widgets[this.dragIndex]) {
              this.node.widgets[this.dragIndex].value = newValue;
            }
            this.node.setDirtyCanvas(true, true);
          }
        };
        canvasEl.addEventListener("pointermove", this._onValuePointerMove);
        this._onGlobalClickToStop = () => {
          this.stopValueDrag();
        };
        document.addEventListener("click", this._onGlobalClickToStop, { capture: true });
        this._onKeyDownToStop = (e) => {
          if (e.key === "Enter") {
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
        for (let i = 0; i < this.pencilRects.length; i++) {
            const r = this.pencilRects[i];
            if (!r) continue;
            if (pos[0] >= r.x && pos[0] <= r.x + r.w &&
                pos[1] >= r.y && pos[1] <= r.y + r.h) {
                const centerX = r.x + (r.w / 2);
                const centerY = r.y + (r.h / 2);
                this.showInlineIntEditor(i, { x: centerX, y: centerY, w: 80, h: 24 }, e);
                return true;
            }
        }
        for (let i = 0; i < this.labelRects.length; i++) {
            const r = this.labelRects[i];
            if (!r) continue;
            if (pos[0] >= r.x && pos[0] <= r.x + r.w &&
                pos[1] >= r.y && pos[1] <= r.y + r.h) {
                const centerX = r.x + (r.w / 2);
                const centerY = r.y + (r.h / 2);
                this.showInlineLabelEditor(i, { x: centerX, y: centerY, w: 80, h: 24 }, e);
                return true;
            }
        }
        for (let i = 0; i < this.incrementRects.length; i++) {
            const r = this.incrementRects[i];
            if (pos[0] >= r.x && pos[0] <= r.x + r.w &&
                pos[1] >= r.y && pos[1] <= r.y + r.h) {
                this.incrementValue(i);
                return true;
            }
        }
        for (let i = 0; i < this.decrementRects.length; i++) {
            const r = this.decrementRects[i];
            if (pos[0] >= r.x && pos[0] <= r.x + r.w &&
                pos[1] >= r.y && pos[1] <= r.y + r.h) {
                this.decrementValue(i);
                return true;
            }
        }
        for (let i = 0; i < this.valueRects.length; i++) {
            const r = this.valueRects[i];
            if (r && pos[0] >= r.x && pos[0] <= r.x + r.w &&
                pos[1] >= r.y && pos[1] <= r.y + r.h) {
              this.startValueDragToggle(i, e);
              return true;
            }
        }
        if (this.gearRect) {
            const r = this.gearRect;
            if (pos[0] >= r.x && pos[0] <= r.x + r.w &&
                pos[1] >= r.y && pos[1] <= r.y + r.h) {
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
            let val = input.value.trim();
            if (val.length > 120) {
              val = val.substring(0, 120);
            }
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
        // Before actually showing the popup, force min/max to resnap to step.
        for (let i = 0; i < this.node.properties.activeCount; i++) {
            const stepVal = this.node.properties.intSteps[i] || 1;
            if (typeof this.node.properties.intMin[i] === "number") {
                const oldMin = this.node.properties.intMin[i];
                const snappedMin = stepVal * Math.round(oldMin / stepVal);
                this.node.properties.intMin[i] = snappedMin;
            }
            if (typeof this.node.properties.intMax[i] === "number") {
                const oldMax = this.node.properties.intMax[i];
                const snappedMax = stepVal * Math.round(oldMax / stepVal);
                this.node.properties.intMax[i] = snappedMax;
            }
        }
        let nodeElem = this.node.htmlElement;
        if (!nodeElem) {
            this.createGearPopupFallback(e.clientX, e.clientY);
            return;
        }
        const nodeRect = nodeElem.getBoundingClientRect();
        const popupX = nodeRect.left + 10;
        const popupY = nodeRect.top + 10;
        const popup = new SettingsPopup(this.node);
        popup.open(popupX, popupY);
        this.populateGearPopup(popup);
    }

// CHANGED populateGearPopup
populateGearPopup(popup) {
    const content = popup.getContentContainer();
    popup.clearContent();
    content.style.maxHeight = "300px";
    content.style.overflowY = "auto";
    content.style.scrollbarWidth = "thin";
    content.style.setProperty("::-webkit-scrollbar", "width: 6px; height: 6px;");
    content.style.setProperty("::-webkit-scrollbar-thumb", "background-color: #4b3e72; border-radius: 10px;");
    content.style.setProperty("::-webkit-scrollbar-track", "background-color: #181818; border-radius: 10px;");

    // Add/Remove Ints
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

    // Steps / Min / Max label
    const stepsLabel = document.createElement("div");
    stepsLabel.textContent = "Steps / Min / Max";
    stepsLabel.style.color = "#fff";
    stepsLabel.style.fontSize = "12px";
    stepsLabel.style.textAlign = "center";
    content.appendChild(stepsLabel);

    // Steps container
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

    const updateStepInputs = () => {
        stepsList.innerHTML = '';
        for (let i = 0; i < this.node.properties.activeCount; i++) {
            const rowDiv = document.createElement("div");
            rowDiv.style.display = "flex";
            rowDiv.style.justifyContent = "center";
            rowDiv.style.alignItems = "center";
            rowDiv.style.marginBottom = "5px";
            rowDiv.style.paddingBottom = "2px";
            rowDiv.style.borderBottom = "2px solid #262626";

            const intLabel = document.createElement("span");
            intLabel.textContent = `i${i + 1}`;
            intLabel.style.color = "#fff";
            intLabel.style.fontSize = "14px";
            intLabel.style.marginRight = "5px";
            rowDiv.appendChild(intLabel);

            const stepInput = document.createElement("input");
            stepInput.type = "number";
            stepInput.value = this.node.properties.intSteps[i] || 1;
            stepInput.min = "1";
            stepInput.style.width = "50px";
            stepInput.style.fontSize = "12px";
            stepInput.style.background = "#333";
            stepInput.style.color = "#fff";
            stepInput.style.border = "2px solid #4b3e72";
            stepInput.style.borderRadius = "6px";
            stepInput.style.textAlign = "center";
            stepInput.style.marginRight = "5px";
            rowDiv.appendChild(stepInput);

            const minInput = document.createElement("input");
            minInput.type = "number";
            minInput.placeholder = "Min";
            minInput.style.width = "50px";
            minInput.style.fontSize = "12px";
            minInput.style.background = "#333";
            minInput.style.color = "#fff";
            minInput.style.border = "2px solid #4b3e72";
            minInput.style.borderRadius = "6px";
            minInput.style.textAlign = "center";
            minInput.style.marginRight = "5px";
            if (typeof this.node.properties.intMin[i] === "number") {
                minInput.value = this.node.properties.intMin[i];
            } else {
                minInput.value = "";
            }
            rowDiv.appendChild(minInput);

            const maxInput = document.createElement("input");
            maxInput.type = "number";
            maxInput.placeholder = "Max";
            maxInput.style.width = "50px";
            maxInput.style.fontSize = "12px";
            maxInput.style.background = "#333";
            maxInput.style.color = "#fff";
            maxInput.style.border = "2px solid #4b3e72";
            maxInput.style.borderRadius = "6px";
            maxInput.style.textAlign = "center";
            if (typeof this.node.properties.intMax[i] === "number") {
                maxInput.value = this.node.properties.intMax[i];
            } else {
                maxInput.value = "";
            }
            rowDiv.appendChild(maxInput);

            stepsList.appendChild(rowDiv);

            stepInput.addEventListener("change", () => {
                const newStep = parseInt(stepInput.value, 10);
                if (isNaN(newStep) || newStep < 1) {
                    stepInput.value = this.node.properties.intSteps[i] || 1;
                    return;
                }
                this.node.properties.intSteps[i] = newStep;

                if (typeof this.node.properties.intMin[i] === "number") {
                    const oldMin = this.node.properties.intMin[i];
                    const steppedMin = newStep * Math.round(oldMin / newStep);
                    if (steppedMin !== oldMin) {
                        this.showEphemeralPopup(
                            `Min not aligned with step. Using stepped value: ${steppedMin}`,
                            stepInput.getBoundingClientRect().left,
                            stepInput.getBoundingClientRect().top - 25
                        );
                    }
                    this.node.properties.intMin[i] = steppedMin;
                    minInput.value = steppedMin.toString();
                }

                if (typeof this.node.properties.intMax[i] === "number") {
                    const oldMax = this.node.properties.intMax[i];
                    const steppedMax = newStep * Math.round(oldMax / newStep);
                    if (steppedMax !== oldMax) {
                        this.showEphemeralPopup(
                            `Max not aligned with step. Using stepped value: ${steppedMax}`,
                            stepInput.getBoundingClientRect().left,
                            stepInput.getBoundingClientRect().top - 25
                        );
                    }
                    this.node.properties.intMax[i] = steppedMax;
                    maxInput.value = steppedMax.toString();
                }
            });

            minInput.addEventListener("change", () => {
                const val = parseInt(minInput.value, 10);
                if (!isNaN(val)) {
                    const stepVal = this.node.properties.intSteps[i] || 1;
                    const steppedVal = stepVal * Math.round(val / stepVal);
                    if (steppedVal !== val) {
                        this.showEphemeralPopup(
                            `Min not aligned with step. Using stepped value: ${steppedVal}`,
                            minInput.getBoundingClientRect().left,
                            minInput.getBoundingClientRect().top - 25
                        );
                    }
                    this.node.properties.intMin[i] = steppedVal;
                    minInput.value = steppedVal.toString();
                } else {
                    this.node.properties.intMin[i] = undefined;
                    minInput.value = "";
                }
            });

            maxInput.addEventListener("change", () => {
                const val = parseInt(maxInput.value, 10);
                if (!isNaN(val)) {
                    const stepVal = this.node.properties.intSteps[i] || 1;
                    const steppedVal = stepVal * Math.round(val / stepVal);
                    if (steppedVal !== val) {
                        this.showEphemeralPopup(
                            `Max not aligned with step. Using stepped value: ${steppedVal}`,
                            maxInput.getBoundingClientRect().left,
                            maxInput.getBoundingClientRect().top - 25
                        );
                    }
                    this.node.properties.intMax[i] = steppedVal;
                    maxInput.value = steppedVal.toString();
                } else {
                    this.node.properties.intMax[i] = undefined;
                    maxInput.value = "";
                }
            });
        }
    };
    updateStepInputs();

    // Color section
    const colorSectionTitle = document.createElement("div");
    colorSectionTitle.textContent = "Background Colors";
    colorSectionTitle.style.color = "#fff";
    colorSectionTitle.style.fontSize = "12px";
    colorSectionTitle.style.textAlign = "center";
    colorSectionTitle.style.marginTop = "5px";
    content.appendChild(colorSectionTitle);

    const colorRow = document.createElement("div");
    colorRow.style.display = "flex";
    colorRow.style.flexWrap = "wrap";
    colorRow.style.alignItems = "center";
    colorRow.style.justifyContent = "space-between";
    colorRow.style.marginBottom = "5px";
    content.appendChild(colorRow);

    // Node BG
    const nodeColorBlock = document.createElement("div");
    nodeColorBlock.style.display = "flex";
    nodeColorBlock.style.alignItems = "center";
    nodeColorBlock.style.gap = "4px";
    colorRow.appendChild(nodeColorBlock);

    const nodeColorLabel = document.createElement("div");
    nodeColorLabel.textContent = "Node";
    nodeColorLabel.style.color = "#fff";
    nodeColorLabel.style.fontSize = "12px";
    nodeColorBlock.appendChild(nodeColorLabel);

    const nodeColorPicker = document.createElement("input");
    nodeColorPicker.type = "color";
    nodeColorPicker.value = this.node.properties.bgColor || "#181818";
    nodeColorPicker.style.width = "40px";
    nodeColorPicker.style.height = "24px";
    nodeColorBlock.appendChild(nodeColorPicker);

    nodeColorPicker.addEventListener("input", (e) => {
        this.node.properties.bgColor = e.target.value;
        this.node.setDirtyCanvas(true, true);
    });

    // Row BG
    const rowBgColorBlock = document.createElement("div");
    rowBgColorBlock.style.display = "flex";
    rowBgColorBlock.style.alignItems = "center";
    rowBgColorBlock.style.gap = "4px";
    colorRow.appendChild(rowBgColorBlock);

    const rowColorLabel = document.createElement("div");
    rowColorLabel.textContent = "Row";
    rowColorLabel.style.color = "#fff";
    rowColorLabel.style.fontSize = "12px";
    rowBgColorBlock.appendChild(rowColorLabel);

    const rowBgColorPicker = document.createElement("input");
    rowBgColorPicker.type = "color";
    rowBgColorPicker.value = this.node.properties.rowBgColor || "#121212";
    rowBgColorPicker.style.width = "40px";
    rowBgColorPicker.style.height = "24px";
    rowBgColorBlock.appendChild(rowBgColorPicker);

    rowBgColorPicker.addEventListener("input", (e) => {
        this.node.properties.rowBgColor = e.target.value;
        this.node.setDirtyCanvas(true, true);
    });

    // Button BG
    const buttonColorBlock = document.createElement("div");
    buttonColorBlock.style.display = "flex";
    buttonColorBlock.style.alignItems = "center";
    buttonColorBlock.style.gap = "4px";
    colorRow.appendChild(buttonColorBlock);

    const buttonColorLabel = document.createElement("div");
    buttonColorLabel.textContent = "Button";
    buttonColorLabel.style.color = "#fff";
    buttonColorLabel.style.fontSize = "12px";
    buttonColorBlock.appendChild(buttonColorLabel);

    const buttonColorPicker = document.createElement("input");
    buttonColorPicker.type = "color";
    buttonColorPicker.value = this.node.properties.buttonColor || "#4b3e72";
    buttonColorPicker.style.width = "40px";
    buttonColorPicker.style.height = "24px";
    buttonColorBlock.appendChild(buttonColorPicker);

    buttonColorPicker.addEventListener("input", (e) => {
        this.node.properties.buttonColor = e.target.value;
        this.node.setDirtyCanvas(true, true);
    });

    // Spacing row
    const spacingRow = document.createElement("div");
    spacingRow.style.display = "flex";
    spacingRow.style.flexWrap = "wrap";
    spacingRow.style.justifyContent = "space-between";
    spacingRow.style.gap = "15px";
    spacingRow.style.marginTop = "8px";
    content.appendChild(spacingRow);

    // Bottom padding
    const bottomPadContainer = document.createElement("div");
    bottomPadContainer.style.display = "flex";
    bottomPadContainer.style.flexDirection = "column";
    bottomPadContainer.style.alignItems = "flex-start";
    spacingRow.appendChild(bottomPadContainer);

    const bottomPaddingLabel = document.createElement("div");
    bottomPaddingLabel.textContent = "Bottom Padding (px)";
    bottomPaddingLabel.style.color = "#fff";
    bottomPaddingLabel.style.fontSize = "12px";
    bottomPadContainer.appendChild(bottomPaddingLabel);

    const bottomPaddingInput = document.createElement("input");
    bottomPaddingInput.type = "number";
    bottomPaddingInput.value = this.node.properties.bottomPadding || 0;
    bottomPaddingInput.style.width = "40px";
    bottomPaddingInput.style.fontSize = "12px";
    bottomPaddingInput.style.background = "#181818";
    bottomPaddingInput.style.color = "#fff";
    bottomPaddingInput.style.textAlign = "center";
    bottomPadContainer.appendChild(bottomPaddingInput);

    bottomPaddingInput.addEventListener("change", () => {
        const newVal = parseInt(bottomPaddingInput.value, 10);
        if (!isNaN(newVal)) {
            this.node.properties.bottomPadding = newVal;
            this.setupOutputsAndWidgets();
            this.node.setDirtyCanvas(true, true);
        }
    });

    // Row spacing
    const rowSpacingContainer = document.createElement("div");
    rowSpacingContainer.style.display = "flex";
    rowSpacingContainer.style.flexDirection = "column";
    rowSpacingContainer.style.alignItems = "flex-start";
    spacingRow.appendChild(rowSpacingContainer);

    const rowSpacingLabel = document.createElement("div");
    rowSpacingLabel.textContent = "Row Gap (px)";
    rowSpacingLabel.style.color = "#fff";
    rowSpacingLabel.style.fontSize = "12px";
    rowSpacingContainer.appendChild(rowSpacingLabel);

    const rowSpacingInput = document.createElement("input");
    rowSpacingInput.type = "number";
    rowSpacingInput.value = (typeof this.node.properties.rowSpacing === "number") ? this.node.properties.rowSpacing : "";
    rowSpacingInput.style.width = "40px";
    rowSpacingInput.style.fontSize = "12px";
    rowSpacingInput.style.background = "#181818";
    rowSpacingInput.style.color = "#fff";
    rowSpacingInput.style.textAlign = "center";
    rowSpacingContainer.appendChild(rowSpacingInput);

    rowSpacingInput.addEventListener("change", () => {
        const newVal = parseFloat(rowSpacingInput.value);
        if (!isNaN(newVal)) {
            this.node.properties.rowSpacing = newVal;
        } else {
            this.node.properties.rowSpacing = undefined;
        }
        this.node.setDirtyCanvas(true, true);
    });

    // Show label container
    const showLabelContainer = document.createElement("div");
    showLabelContainer.style.display = "flex";
    showLabelContainer.style.flexDirection = "column";
    showLabelContainer.style.alignItems = "flex-start";
    spacingRow.appendChild(showLabelContainer);

    const showLabelDiv = document.createElement("div");
    showLabelDiv.textContent = "Show # Labels";
    showLabelDiv.style.color = "#fff";
    showLabelDiv.style.fontSize = "12px";
    showLabelContainer.appendChild(showLabelDiv);

    const showLabelCheckbox = document.createElement("input");
    showLabelCheckbox.type = "checkbox";
    showLabelCheckbox.style.marginTop = "2px";
    showLabelCheckbox.checked = (this.node.properties.showStaticLabelAndLine !== false);
    showLabelContainer.appendChild(showLabelCheckbox);

    showLabelCheckbox.addEventListener("change", (e) => {
        this.node.properties.showStaticLabelAndLine = e.target.checked;
        this.node.setDirtyCanvas(true, true);
    });

    // Existing group labels
    const existingLabelsHeader = document.createElement("div");
    existingLabelsHeader.textContent = "Existing Group Labels";
    existingLabelsHeader.style.color = "#fff";
    existingLabelsHeader.style.fontSize = "12px";
    existingLabelsHeader.style.textAlign = "center";
    content.appendChild(existingLabelsHeader);

    const groupLabelsContainer = document.createElement("div");
    groupLabelsContainer.style.display = "flex";
    groupLabelsContainer.style.flexDirection = "column";
    groupLabelsContainer.style.gap = "4px";
    groupLabelsContainer.style.marginBottom = "10px";
    content.appendChild(groupLabelsContainer);

    const refreshGroupLabelsUI = () => {
        groupLabelsContainer.innerHTML = "";
        for (let i = 0; i < this.node.properties.groupLabels?.length || 0; i++) {
            const gl = this.node.properties.groupLabels[i];
            const rowDiv = document.createElement("div");
            rowDiv.style.display = "flex";
            rowDiv.style.gap = "5px";

            const textInput = document.createElement("input");
            textInput.type = "text";
            textInput.value = gl.text;
            textInput.style.width = "120px";
            rowDiv.appendChild(textInput);

            const colorInput = document.createElement("input");
            colorInput.type = "color";
            colorInput.value = gl.bgColor || "#242424";
            colorInput.style.width = "40px";
            rowDiv.appendChild(colorInput);

            const rowSelect = document.createElement("select");
            for (let r = 0; r <= this.node.properties.activeCount; r++) {
                const opt = document.createElement("option");
                opt.value = r;
                opt.text = (r === this.node.properties.activeCount)
                    ? `After row ${r}`
                    : `Before row ${r + 1}`;
                if (r === gl.beforeRow) {
                    opt.selected = true;
                }
                rowSelect.appendChild(opt);
            }
            rowDiv.appendChild(rowSelect);

            const removeBtn = document.createElement("button");
            removeBtn.textContent = "X";
            removeBtn.style.background = "#a33";
            removeBtn.style.color = "#fff";
            rowDiv.appendChild(removeBtn);

            removeBtn.addEventListener("click", () => {
                this.node.properties.groupLabels.splice(i, 1);
                this.node.setDirtyCanvas(true, true);
                refreshGroupLabelsUI();
            });

            textInput.addEventListener("change", () => {
                gl.text = textInput.value;
                this.node.setDirtyCanvas(true, true);
            });

            colorInput.addEventListener("input", () => {
                gl.bgColor = colorInput.value;
                this.node.setDirtyCanvas(true, true);
            });

            rowSelect.addEventListener("change", () => {
                gl.beforeRow = parseInt(rowSelect.value, 10);
                this.node.setDirtyCanvas(true, true);
            });

            groupLabelsContainer.appendChild(rowDiv);
        }
    };
    if (!Array.isArray(this.node.properties.groupLabels)) {
        this.node.properties.groupLabels = [];
    }
    refreshGroupLabelsUI();

    const addGroupLabelBtn = document.createElement("button");
    addGroupLabelBtn.textContent = "+ Group Label";
    addGroupLabelBtn.style.background = "#444";
    addGroupLabelBtn.style.color = "#fff";
    content.appendChild(addGroupLabelBtn);

    addGroupLabelBtn.addEventListener("click", () => {
        const newRow = document.createElement("div");
        newRow.style.marginTop = "5px";
        newRow.style.marginLeft = "5px";
        newRow.style.marginRight = "5px";
        newRow.style.display = "flex";
        newRow.style.gap = "5px";

        const lblInput = document.createElement("input");
        lblInput.type = "text";
        lblInput.placeholder = "Label text...";
        lblInput.style.width = "120px";
        newRow.appendChild(lblInput);

        const colorInput = document.createElement("input");
        colorInput.type = "color";
        colorInput.value = "#242424";
        colorInput.style.width = "40px";
        newRow.appendChild(colorInput);

        const rowSelect = document.createElement("select");
        for (let i = 0; i <= this.node.properties.activeCount; i++) {
            const opt = document.createElement("option");
            opt.value = i;
            opt.text = (i === this.node.properties.activeCount)
                ? `After row ${i}`
                : `Before row ${i + 1}`;
            rowSelect.appendChild(opt);
        }
        newRow.appendChild(rowSelect);

        const saveBtn = document.createElement("button");
        saveBtn.textContent = "Add";
        saveBtn.style.background = "#666";
        saveBtn.style.color = "#fff";
        newRow.appendChild(saveBtn);

        saveBtn.addEventListener("click", () => {
            const textVal = lblInput.value.trim() || "Untitled Group";
            const beforeRowVal = parseInt(rowSelect.value, 10) || 0;
            this.node.properties.groupLabels.push({
                text: textVal,
                beforeRow: beforeRowVal,
                bgColor: colorInput.value
            });
            this.node.setDirtyCanvas(true, true);
            newRow.remove();
            refreshGroupLabelsUI();
        });

        content.appendChild(newRow);
    });

    minusBtn.addEventListener("click", (evt) => {
        evt.stopPropagation();
        const currentWidth = this.node.size[0];
        if (this.node.properties.activeCount > 1) {
            this.node.properties.activeCount = Math.max(1, this.node.properties.activeCount - 1);
            this.adjustArrays();
            updateStepInputs();
            this.setupOutputsAndWidgets();
            if (this.node.onOutputsChange) {
                this.node.onOutputsChange();
            }
            this.node.setDirtyCanvas(true, true);
            this.node.size[0] = currentWidth;
            this.node.setDirtyCanvas(true, true);
            setTimeout(() => popup.reposition(this.node.htmlElement, 10, 10), 50);
        }
    });

    plusBtn.addEventListener("click", (evt) => {
        evt.stopPropagation();
        const currentWidth = this.node.size[0];
        if (this.node.properties.activeCount < 20) {
            this.node.properties.activeCount = Math.min(20, this.node.properties.activeCount + 1);
            this.adjustArrays();
            updateStepInputs();
            this.setupOutputsAndWidgets();
            if (this.node.onOutputsChange) {
                this.node.onOutputsChange();
            }
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
        this.populateGearPopup(popup);
    }

    showInlineIntEditor(index, rect, e) {
        e.preventDefault();
        e.stopPropagation();
        const graphCanvas = app.graphcanvas;
        if (!graphCanvas) {
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
          let inputVal = input.value.trim();
          if (inputVal.length > 0) {
            let result;
            try {
              if (/^[0-9+\-*/().\s]+$/.test(inputVal)) {
                result = eval(inputVal);
              } else {
                result = parseInt(inputVal, 10);
              }
            } catch {
              result = parseInt(inputVal, 10);
            }
    
            if (!isNaN(result)) {
              const messages = [];
              const popupRect = input.getBoundingClientRect();
              const popupX = popupRect.left;
              const popupY = popupRect.top - 35;  
    
              const oldVal = result;
              const step = this.node.properties.intSteps[index] || 1;
              const steppedVal = step * Math.round(result / step);
    
              // If step rounding changed the value
              if (steppedVal !== oldVal) {
                messages.push(`Set value not within step.`);
              }
    
              // Then clamp to min/max
              const finalVal = this.clampValue(index, steppedVal);
    
              // If clamp changed it again
              if (finalVal !== steppedVal) {
                const reason = finalVal === this.node.properties.intMin[index]
                  ? `Min (${finalVal})`
                  : `Max (${finalVal})`;
                messages.push(`Set value out of range.`);
              }
    
              // Now, if there were any adjustments, append a note of the final
              if (messages.length > 0) {
                messages.push(`Set value: ${finalVal}`);
                this.showEphemeralPopup(messages.join(" | "), popupX, popupY);
              }
    
              this.node.properties.values[index] = finalVal;
              if (this.node.widgets[index]) {
                this.node.widgets[index].value = finalVal;
              }
              this.node.setDirtyCanvas(true, true);
            }
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
    
    showEphemeralPopup(message, x, y) {
        const popup = document.createElement("div");
        popup.textContent = message;
        popup.style.position = "fixed";
        popup.style.left = x + "px";
        popup.style.top = y + "px";
        popup.style.padding = "6px 10px";
        popup.style.fontSize = "12px";
        popup.style.background = "#333";
        popup.style.color = "#fff";
        popup.style.border = "2px solid #4b3e72";
        popup.style.borderRadius = "6px";
        popup.style.zIndex = "999999";
        document.body.appendChild(popup);
    
        setTimeout(() => {
            if (popup.parentNode) {
                popup.parentNode.removeChild(popup);
            }
        }, 2000);
    }

    incrementValue(index) {
        const step = (this.node.properties.intSteps && this.node.properties.intSteps[index]) || 1;
        let v = this.node.properties.values[index] + step;
        v = this.clampValue(index, v);
        this.node.properties.values[index] = v;
        if (this.node.widgets[index]) {
          this.node.widgets[index].value = v;
        }
        this.node.setDirtyCanvas(true, true);
    }

    decrementValue(index) {
        const step = (this.node.properties.intSteps && this.node.properties.intSteps[index]) || 1;
        let v = this.node.properties.values[index] - step;
        v = this.clampValue(index, v);
        this.node.properties.values[index] = v;
        if (this.node.widgets[index]) {
          this.node.widgets[index].value = v;
        }
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
        while (this.node.properties.intSteps.length < count) {
            this.node.properties.intSteps.push(1);
        }
        this.node.properties.intSteps.length = count;
        while (this.node.properties.intMin.length < count) {
            this.node.properties.intMin.push(undefined);
        }
        this.node.properties.intMin.length = count;
        while (this.node.properties.intMax.length < count) {
            this.node.properties.intMax.push(undefined);
        }
        this.node.properties.intMax.length = count;
    }
}

app.registerExtension({
    name: "AIDocsClinicalTools.MultiInt",
    async beforeRegisterNodeDef(nodeType, nodeData) {
        if (nodeData.name === "MultiInt") {
            Object.assign(nodeType.prototype, {
                onNodeCreated() {
                    this.multiIntNode = new MultiIntNode(this);
                },
                onMouseDown(e, pos) {
                    return this.multiIntNode.onMouseDown(e, pos);
                },
            });
        }
    }
});
