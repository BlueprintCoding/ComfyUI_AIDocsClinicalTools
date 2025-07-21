class MultiFloatNodeAID:
    @classmethod
    def INPUT_TYPES(cls):
        # Define up to 20 potential float inputs.
        optional = {
            f"value{i+1}": (
                "FLOAT",
                {
                    "default": 0.0,
                    "min": -3.4e38,    # or another large negative float if needed
                    "max": 3.4e38,     # or another large positive float if needed
                    "step": 0.1,       # default step for float
                    "hide": True,
                },
            )
            for i in range(20)
        }
        return {
            "required": {},
            "optional": optional,
        }

    RETURN_TYPES = ("FLOAT",) * 20
    RETURN_NAMES = tuple(f"f{i+1}" for i in range(20))
    FUNCTION = "process"
    CATEGORY = "AIDoc"
    UI = "MultiFloatNodeAID"  # This should match your JS filename for the node

    def process(self, **kwargs):
        outputs = []
        for i in range(20):
            key = f"value{i+1}"
            val = kwargs.get(key, 0.0)
            outputs.append(float(val))
        return tuple(outputs)


NODE_CLASS_MAPPINGS = {"MultiFloatNodeAID": MultiFloatNodeAID}
NODE_DISPLAY_NAME_MAPPINGS = {"MultiFloatNodeAID": "🩺 Multi Float"}
