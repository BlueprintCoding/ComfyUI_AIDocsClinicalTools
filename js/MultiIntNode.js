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
        if (typeof node.properties.bottomPadding !== "number") {
            node.properties.bottomPadding = 0;
        }
        if (typeof node.properties.minWidth !== "number") {
            node.properties.minWidth = 250;
        }
        if (typeof node.properties.maxWidth !== "number") {
            node.properties.maxWidth = 1000;
        }

        this.labelRects = [];
        this.valueRects = [];
        this.pencilRects = [];
        this.incrementRects = [];
        this.decrementRects = [];
        this.gearRect = null;

        this.setupOutputsAndWidgets();
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
          this.node.outputs[i].name = `i${i+1}`;
        }
        this.node.size[0] = oldSize[0];
    }

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
        const rowHeight = 30;
        const rowSpacing = margin;
        const count = this.node.properties.activeCount;
        const neededHeight = margin + count * (rowHeight + rowSpacing) + (this.node.properties.bottomPadding || 0);
        if (this.node.size[1] < neededHeight) {
          this.node.size[1] = neededHeight;
        } else if (this.node.size[1] > neededHeight) {
          this.node.size[1] = neededHeight;
        }
        if (this.node.size[0] < this.node.properties.minWidth) {
            this.node.size[0] = this.node.properties.minWidth;
        }
        if (this.node.size[0] > this.node.properties.maxWidth) {
            this.node.size[0] = this.node.properties.maxWidth;
        }

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
        for (let i = 0; i < count; i++) {
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
            const staticLabel = `·i${i + 1}`;
            const staticLabelMetrics = ctx.measureText(staticLabel);
            const staticLabelX = margin + 2;
            const staticLabelY = y + rowHeight / 2;
            ctx.fillText(staticLabel, staticLabelX, staticLabelY);

            const lineStartX = staticLabelX + staticLabelMetrics.width + 4;
            ctx.strokeStyle = rowTextColor;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(lineStartX, staticLabelY - rowHeight / 2);
            ctx.lineTo(lineStartX, staticLabelY + rowHeight / 2);
            ctx.stroke();

            const valX = margin + rowBgWidth - 90;
            const valY = staticLabelY;

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

            ctx.fillStyle = rowTextColor;
            ctx.font = "14px Arial";
            ctx.fillText(displayLabel, labelAreaStart, staticLabelY);

            const displayedLabelWidth = ctx.measureText(displayLabel).width;
            this.labelRects[i] = {
                x: labelAreaStart,
                y,
                w: displayedLabelWidth + 8,
                h: rowHeight
            };

            const val = this.node.properties.values[i] ?? 0;
            const valStr = val.toString();
            ctx.textAlign = "right";
            ctx.font = "14px Arial";
            const valMetrics = ctx.measureText(valStr);
            ctx.fillText(valStr, valX, valY);
            this.valueRects[i] = {
                x: valX - valMetrics.width - 4,
                y,
                w: valMetrics.width + 8,
                h: rowHeight
            };

            ctx.textAlign = "left";
            ctx.fillStyle = rowTextColor;
            ctx.font = "16px Arial";
            const pencilIcon = "✎";
            const pencilMetrics = ctx.measureText(pencilIcon);
            const pencilX = valX + 6;
            ctx.fillText(pencilIcon, pencilX, valY);
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

        const bottomPad = parseInt(this.node.properties.bottomPadding, 10) || 0;
        if (bottomPad > 0) {
          ctx.fillStyle = "#181818";
          ctx.fillRect(margin + radius, y, rowBgWidth, bottomPad);
          y += bottomPad;
        }
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

    populateGearPopup(popup) {
        const content = popup.getContentContainer();
        popup.clearContent();
        content.style.maxHeight = "300px";
        content.style.overflowY = "auto";
        content.style.scrollbarWidth = "thin";
        content.style.setProperty("::-webkit-scrollbar", "width: 6px; height: 6px;");
        content.style.setProperty("::-webkit-scrollbar-thumb", "background-color: #4b3e72; border-radius: 10px;");
        content.style.setProperty("::-webkit-scrollbar-track", "background-color: #181818; border-radius: 10px;");

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
        stepsLabel.textContent = "Steps / Min / Max";
        stepsLabel.style.color = "#fff";
        stepsLabel.style.fontSize = "12px";
        stepsLabel.style.textAlign = "center";
        content.appendChild(stepsLabel);

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
                stepInput.addEventListener("change", () => {
                    const newStep = parseInt(stepInput.value, 10);
                    if (!isNaN(newStep) && newStep >= 1) {
                        this.node.properties.intSteps[i] = newStep;
                    } else {
                        stepInput.value = this.node.properties.intSteps[i] || 1;
                    }
                });
                rowDiv.appendChild(stepInput);

                const minInput = document.createElement("input");
                minInput.type = "number";
                if (typeof this.node.properties.intMin[i] === "number") {
                    minInput.value = this.node.properties.intMin[i];
                } else {
                    minInput.value = "";
                }
                minInput.placeholder = "Min";
                minInput.style.width = "50px";
                minInput.style.fontSize = "12px";
                minInput.style.background = "#333";
                minInput.style.color = "#fff";
                minInput.style.border = "2px solid #4b3e72";
                minInput.style.borderRadius = "6px";
                minInput.style.textAlign = "center";
                minInput.style.marginRight = "5px";
                minInput.addEventListener("change", () => {
                    const val = parseInt(minInput.value, 10);
                    if (!isNaN(val)) {
                        this.node.properties.intMin[i] = val;
                    } else {
                        this.node.properties.intMin[i] = undefined;
                        minInput.value = "";
                    }
                });
                rowDiv.appendChild(minInput);

                const maxInput = document.createElement("input");
                maxInput.type = "number";
                if (typeof this.node.properties.intMax[i] === "number") {
                    maxInput.value = this.node.properties.intMax[i];
                } else {
                    maxInput.value = "";
                }
                maxInput.placeholder = "Max";
                maxInput.style.width = "50px";
                maxInput.style.fontSize = "12px";
                maxInput.style.background = "#333";
                maxInput.style.color = "#fff";
                maxInput.style.border = "2px solid #4b3e72";
                maxInput.style.borderRadius = "6px";
                maxInput.style.textAlign = "center";
                maxInput.addEventListener("change", () => {
                    const val = parseInt(maxInput.value, 10);
                    if (!isNaN(val)) {
                        this.node.properties.intMax[i] = val;
                    } else {
                        this.node.properties.intMax[i] = undefined;
                        maxInput.value = "";
                    }
                });
                rowDiv.appendChild(maxInput);

                stepsList.appendChild(rowDiv);
            }
        };
        updateStepInputs();

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
        colorPicker.style.minHeight = "25px";
        colorPicker.style.width = "100%";
        colorPicker.style.marginBottom = "0px";
        content.appendChild(colorPicker);
        colorPicker.addEventListener("input", (e) => {
            this.node.properties.bgColor = e.target.value;
            this.node.setDirtyCanvas(true, true);
        });

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
        rowBgColorPicker.style.minHeight = "25px";
        rowBgColorPicker.style.width = "100%";
        rowBgColorPicker.style.marginBottom = "0px";
        content.appendChild(rowBgColorPicker);
        rowBgColorPicker.addEventListener("input", (e) => {
            this.node.properties.rowBgColor = e.target.value;
            this.node.setDirtyCanvas(true, true);
        });

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
        buttonColorPicker.style.minHeight = "25px";
        buttonColorPicker.style.width = "100%";
        buttonColorPicker.style.marginBottom = "0px";
        content.appendChild(buttonColorPicker);
        buttonColorPicker.addEventListener("input", (e) => {
            this.node.properties.buttonColor = e.target.value;
            this.node.setDirtyCanvas(true, true);
        });

        const bottomPaddingLabel = document.createElement("div");
        bottomPaddingLabel.textContent = "Bottom Padding (px)";
        bottomPaddingLabel.style.color = "#fff";
        bottomPaddingLabel.style.fontSize = "12px";
        bottomPaddingLabel.style.textAlign = "center";
        content.appendChild(bottomPaddingLabel);

        const bottomPaddingInput = document.createElement("input");
        bottomPaddingInput.type = "number";
        bottomPaddingInput.value = this.node.properties.bottomPadding || 0;
        bottomPaddingInput.style.width = "60px";
        bottomPaddingInput.style.fontSize = "12px";
        bottomPaddingInput.style.background = "#181818";
        bottomPaddingInput.style.color = "#fff";
        bottomPaddingInput.style.textAlign = "center";
        content.appendChild(bottomPaddingInput);
        bottomPaddingInput.addEventListener("change", () => {
          const newVal = parseInt(bottomPaddingInput.value, 10);
          if (!isNaN(newVal)) {
            this.node.properties.bottomPadding = newVal;
            this.setupOutputsAndWidgets();
            this.node.setDirtyCanvas(true, true);
          }
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
            const oldVal = result;
            result = this.clampValue(index, result);
            this.node.properties.values[index] = result;
  
            // If clampValue changed the result, show ephemeral popup above input
            if (oldVal !== result) {
              const rect = input.getBoundingClientRect();
              const popupX = rect.left;
              const popupY = rect.top - 35; // a bit above the input
              const reason = (result === this.node.properties.intMin[index]) 
                             ? `Min (${this.node.properties.intMin[index]})`
                             : `Max (${this.node.properties.intMax[index]})`;
              this.showEphemeralPopup(`Set value out of range. Using ${reason}`, popupX, popupY);
            }
  
            if (this.node.widgets[index]) {
              this.node.widgets[index].value = result;
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
  
  onValueChanged(index, val) {
      let n = parseInt(val, 10) || 0;
      n = this.clampValue(index, n);
      this.node.properties.values[index] = n;
      this.node.setDirtyCanvas(true, true);
  }
  
  clampValue(index, val) {
    const minVal = this.node.properties.intMin[index];
    const maxVal = this.node.properties.intMax[index];
    const originalVal = val;
    if (typeof minVal === "number" && val < minVal) {
        val = minVal;
    }
    if (typeof maxVal === "number" && val > maxVal) {
        val = maxVal;
    }
    if (val !== originalVal) {
        const reason = (val === minVal) ? `Min (${minVal})` : `Max (${maxVal})`;
        this.showEphemeralPopup(`Set value out of range. Using ${reason}`);
    }
    return val;
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
