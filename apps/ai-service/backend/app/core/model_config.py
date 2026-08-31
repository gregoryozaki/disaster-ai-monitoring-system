import os

from pathlib import Path


MODEL_ARTIFACT_NAME = (
    "kamara_visual_mobilenet_v3_large_v1"
)

MODEL_FILENAME = (
    f"{MODEL_ARTIFACT_NAME}.onnx"
)

CLASS_MAPPING_FILENAME = (
    "class_mapping.json"
)

NLP_MODEL_ARTIFACT_NAME = (
    "kamara_bertimbau_v2"
)

NLP_RUN_METADATA_FILENAME = (
    "run_metadata.json"
)


def _repository_root() -> Path:
    """
    Resolve a raiz do monorepo durante
    o desenvolvimento local.

    constants.py/model_config.py está em:

    apps/ai-service/backend/app/core/

    Portanto parents[5] corresponde
    à raiz do repositório.
    """

    return (
        Path(__file__)
        .resolve()
        .parents[5]
    )


DEFAULT_VISUAL_MODEL_DIR = (
    _repository_root()
    / "ml"
    / "artifacts"
    / "computer-vision"
    / MODEL_ARTIFACT_NAME
)


VISUAL_MODEL_DIR = Path(
    os.getenv(
        "KAMARA_VISUAL_MODEL_DIR",
        str(
            DEFAULT_VISUAL_MODEL_DIR
        ),
    )
).expanduser().resolve()


VISUAL_MODEL_PATH = (
    VISUAL_MODEL_DIR
    / MODEL_FILENAME
)


VISUAL_CLASS_MAPPING_PATH = (
    VISUAL_MODEL_DIR
    / CLASS_MAPPING_FILENAME
)


DEFAULT_NLP_MODEL_DIR = (
    _repository_root()
    / "ml"
    / "artifacts"
    / "nlp"
    / NLP_MODEL_ARTIFACT_NAME
)


NLP_MODEL_DIR = Path(
    os.getenv(
        "KAMARA_NLP_MODEL_DIR",
        str(
            DEFAULT_NLP_MODEL_DIR
        ),
    )
).expanduser().resolve()


NLP_RUN_METADATA_PATH = (
    NLP_MODEL_DIR
    / NLP_RUN_METADATA_FILENAME
)


NLP_DEVICE = (
    os.getenv(
        "KAMARA_NLP_DEVICE",
        "cpu",
    )
    .strip()
    .lower()
)