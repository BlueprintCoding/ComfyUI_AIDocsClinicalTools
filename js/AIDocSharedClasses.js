// AIDocSharedClasses.js
// Shared class for a styled popup with header + content container.

export class SettingsPopup {
    constructor(node) {
        // Node reference if needed
        this.node = node;

        // Root popup
        this.popupElement = document.createElement("div");
        this.popupElement.style.position = "fixed";
        this.popupElement.style.width = "180px";
        this.popupElement.style.background = "#181818";
        this.popupElement.style.border = "2px solid #4b3e72";
        this.popupElement.style.borderRadius = "6px";
        this.popupElement.style.zIndex = "11000";
        this.popupElement.style.display = "flex";
        this.popupElement.style.flexDirection = "column";
        this.popupElement.style.alignItems = "center";
        this.popupElement.style.gap = "0px"; // We'll add content padding

        // Header
        this.headerElement = document.createElement("div");
        this.headerElement.textContent = "Multi Int Node Settings";
        this.headerElement.style.width = "100%";
        this.headerElement.style.color = "#fff";
        this.headerElement.style.fontSize = "14px";
        this.headerElement.style.padding = "6px 0";
        this.headerElement.style.textAlign = "center";
        this.headerElement.style.background = "#131313"; // darker background
        this.headerElement.style.borderBottom = "2px solid #4b3e72";
        this.headerElement.style.borderRadius = "4px 4px 0 0";
        this.popupElement.appendChild(this.headerElement);

        // Content container
        this.contentContainer = document.createElement("div");
        this.contentContainer.style.width = "100%";
        this.contentContainer.style.padding = "8px";
        this.contentContainer.style.display = "flex";
        this.contentContainer.style.flexDirection = "column";
        this.contentContainer.style.alignItems = "center";
        this.contentContainer.style.gap = "8px";
        this.popupElement.appendChild(this.contentContainer);
    }


    open() {
        // Center the popup in the viewport
        const windowWidth = window.innerWidth;
        const windowHeight = window.innerHeight;
        const popupWidth = this.popupElement.offsetWidth;
        const popupHeight = this.popupElement.offsetHeight;

        const left = (windowWidth - popupWidth) / 2;
        const top = (windowHeight - popupHeight) / 2 - 100;

        this.popupElement.style.left = `${left}px`;
        this.popupElement.style.top = `${top}px`;

        document.body.appendChild(this.popupElement);

        // Outside click to close
        const closePopup = (evt) => {
            if (!this.popupElement.contains(evt.target)) {
                this.close();
                document.removeEventListener("click", closePopup, true);
            }
        };
        setTimeout(() => {
            document.addEventListener("click", closePopup, true);
        }, 100);
    }

    close() {
        if (this.popupElement.parentNode) {
            this.popupElement.parentNode.removeChild(this.popupElement);
        }
    }

    setHeader(text) {
        this.headerElement.textContent = text;
    }

    getContentContainer() {
        return this.contentContainer;
    }

    clearContent() {
        this.contentContainer.innerHTML = "";
    }

    reposition(relativeElem, offsetX = 10, offsetY = 10) {
        if (!relativeElem) return;
        const rect = relativeElem.getBoundingClientRect();
        this.popupElement.style.left = (rect.left + offsetX) + "px";
        this.popupElement.style.top = (rect.top + offsetY) + "px";
    }
}
