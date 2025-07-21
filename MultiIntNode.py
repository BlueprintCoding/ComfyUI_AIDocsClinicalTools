class MultiInt:
    @classmethod
    def INPUT_TYPES(cls):
        # In Python, just define the maximum possible inputs (20).
        optional = {
            f"value{i+1}": (
                "INT",
                {
                    "default": 0,
                    "min": -2147483648,
                    "max": 2147483647,
                    "step": 1,
                    "hide": True,       # hidden by default, the JS can show them
                },
            )
            for i in range(20)
        }
        return {
            "required": {},
            "optional": optional,
        }

    # Return 20 int outputs, though the JS may remove or hide some
    RETURN_TYPES = ("INT",) * 20
    RETURN_NAMES = tuple(f"i{i+1}" for i in range(20))
    FUNCTION = "process"
    CATEGORY = "AIDoc"
    UI = "MultiIntNode"  # Must match the JS filename "MultiIntNode.js"

    def process(self, **kwargs):
        # The JS side might only have, say, 'sliderCount' = 5,
        # but we still define all 20 in Python. We'll rely on
        # the JS to remove extra outputs from the UI.
        outputs = []
        for i in range(20):
            key = f"value{i+1}"
            val = kwargs.get(key, 0)
            outputs.append(int(val))
        return tuple(outputs)


NODE_CLASS_MAPPINGS = {"MultiInt": MultiInt}
NODE_DISPLAY_NAME_MAPPINGS = {"MultiInt": "🩺 Multi Int"}
