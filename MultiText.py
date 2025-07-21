# MultiText.py
class MultiText:
    @classmethod
    def INPUT_TYPES(s):
        return {
        "required": {
        },
            "hidden": {
                **{f"enabled{i}": ("BOOLEAN", {"default": True}) for i in range(1, 21)},
                **{f"text{i}": ("STRING", {"multiline": True}) for i in range(1, 21)},
                **{f"weight{i}": ("FLOAT", {
                    "default": 1.0,
                    "min": 0.0,
                    "max": 2.0,
                    "step": 0.1
                }) for i in range(1, 21)},
                **{"separator": ("STRING", {
                "default": " ",
                "multiline": False,
                "visible": False,
                "widget": "hidden"
            })},
            **{"active": ("BOOLEAN", {
                "default": True,
                "visible": False,
                "widget": "hidden"
            })},
            }
        }
    
    RETURN_TYPES = ("STRING",)
    RETURN_NAMES = ("*",)
    FUNCTION = "combine_text"
    CATEGORY = "AIDoc"
    
    def combine_text(self, separator=" ", active=True, **kwargs):
        if not active:
            return ("",)

        texts = []
        for i in range(1, 21):
            # read enabled{i}
            enabled = kwargs.get(f"enabled{i}", True)
            if not enabled:
                continue  # skip if disabled

            text = kwargs.get(f"text{i}", "").strip()
            weight = 1.0
            if weight is None:
                weight = 1.0

            if text:
                if weight == 1.0:
                    texts.append(text)
                else:
                     texts.append(text)

        return (separator.join(texts),)


# Mappings for MultiText
NODE_CLASS_MAPPINGS = {
    "MultiText": MultiText  # Class mapping for the MultiText node
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "MultiText": "🩺 Multi Text"  # Display name for the MultiText node
}
