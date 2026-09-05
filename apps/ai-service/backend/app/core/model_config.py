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
    Localiza dinamicamente a raiz do monorepo.

    Essa resolução é usada somente quando os
    diretórios dos modelos não são informados
    explicitamente por variáveis de ambiente.
    """

    current_file = Path(__file__).resolve()

    for parent in current_file.parents:
        if (
            (parent / "package.json").is_file()
            and (parent / "ml" / "artifacts").is_dir()
        ):
            return parent

    raise RuntimeError(
        "Não foi possível localizar a raiz do "
        "repositório Kamara. Configure "
        "KAMARA_VISUAL_MODEL_DIR e "
        "KAMARA_NLP_MODEL_DIR."
    )


def _resolve_model_dir(
    env_name: str,
    *default_parts: str,
) -> Path:
    """
    Usa primeiro o caminho explicitamente
    configurado por variável de ambiente.

    Somente quando a variável não existe é
    necessário localizar a raiz do repositório.
    """

    configured_path = os.getenv(env_name)

    if configured_path:
        return (
            Path(configured_path)
            .expanduser()
            .resolve()
        )

    return (
        _repository_root()
        .joinpath(*default_parts)
        .expanduser()
        .resolve()
    )


VISUAL_MODEL_DIR = _resolve_model_dir(
    "KAMARA_VISUAL_MODEL_DIR",
    "ml",
    "artifacts",
    "computer-vision",
    MODEL_ARTIFACT_NAME,
)


VISUAL_MODEL_PATH = (
    VISUAL_MODEL_DIR
    / MODEL_FILENAME
)


VISUAL_CLASS_MAPPING_PATH = (
    VISUAL_MODEL_DIR
    / CLASS_MAPPING_FILENAME
)


NLP_MODEL_DIR = _resolve_model_dir(
    "KAMARA_NLP_MODEL_DIR",
    "ml",
    "artifacts",
    "nlp",
    NLP_MODEL_ARTIFACT_NAME,
)


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