from __future__ import annotations

import json
import logging

from dataclasses import dataclass
from io import BytesIO
from pathlib import Path
from typing import (
    Literal,
    Protocol,
    cast,
)

import numpy as np
import onnxruntime as ort

from PIL import (
    Image,
    UnidentifiedImageError,
)

from app.core.constants import (
    ALLOWED_IMAGE_MIME_TYPES,
)

from app.core.model_config import (
    VISUAL_CLASS_MAPPING_PATH,
    VISUAL_MODEL_PATH,
)

from app.schemas.classification import (
    AIResultStatus,
)


logger = logging.getLogger(
    __name__
)


VisualLabel = Literal[
    "FLOOD_WATER",
    "FIRE_SMOKE",
    "OTHER",
    "UNCERTAIN",
]


SUPPORTED_MODEL_LABELS = {
    "FLOOD_WATER",
    "FIRE_SMOKE",
    "OTHER",
}


PIL_FORMAT_TO_MIME = {
    "JPEG": "image/jpeg",
    "PNG": "image/png",
    "WEBP": "image/webp",
}


CANDIDATE_COBRADE_CODES: dict[
    VisualLabel,
    tuple[str, ...],
] = {
    "FLOOD_WATER": (
        "1.2.1.0.0",
        "1.2.2.0.0",
        "1.2.3.0.0",
    ),
    "FIRE_SMOKE": (
        "1.4.1.3.1",
        "1.4.1.3.2",
        "2.3.1.1.0",
        "2.3.1.2.0",
    ),
    "OTHER": (),
    "UNCERTAIN": (),
}


@dataclass(frozen=True)
class VisualClassificationResult:
    result_status: AIResultStatus

    predicted_label: VisualLabel | None

    confidence: float | None

    candidate_cobrade_codes: tuple[str, ...]

    explanation_simple: str

    model_name: str

    model_version: str

    synthetic_data: bool


class VisualClassifier(Protocol):
    def classify(
        self,
        *,
        image_bytes: bytes,
        content_type: str,
    ) -> VisualClassificationResult:
        ...


class UnavailableVisualClassifier:
    """
    Fallback utilizado quando o artefato
    visual não pode ser carregado.
    """

    def classify(
        self,
        *,
        image_bytes: bytes,
        content_type: str,
    ) -> VisualClassificationResult:
        return VisualClassificationResult(
            result_status="UNAVAILABLE",
            predicted_label=None,
            confidence=None,
            candidate_cobrade_codes=(),
            explanation_simple=(
                "A imagem foi recebida, mas "
                "o modelo visual não está "
                "disponível para inferência."
            ),
            model_name=(
                "visual-model-unavailable"
            ),
            model_version="0.0.0",
            synthetic_data=False,
        )


class OnnxVisualClassifier:
    """
    Classificador visual baseado em
    MobileNetV3 exportado para ONNX.

    O pré-processamento replica a avaliação
    utilizada durante o treinamento:

    1. valida o formato real da imagem;
    2. valida MIME declarado x formato real;
    3. converte para RGB;
    4. resize do menor lado para 256 px;
    5. center crop 224x224;
    6. converte [0, 255] para [0, 1];
    7. normaliza com parâmetros ImageNet;
    8. HWC -> CHW;
    9. adiciona dimensão de batch.
    """

    RESIZE_SHORTER_SIDE = 256

    def __init__(
        self,
        *,
        model_path: Path,
        class_mapping_path: Path,
    ) -> None:
        self._model_path = (
            model_path.resolve()
        )

        self._class_mapping_path = (
            class_mapping_path.resolve()
        )

        mapping = self._load_mapping(
            self._class_mapping_path
        )

        self._model_name = str(
            mapping["modelName"]
        )

        self._model_version = str(
            mapping["modelVersion"]
        )

        self._index_to_label = (
            self._parse_index_to_label(
                mapping[
                    "indexToLabel"
                ]
            )
        )

        uncertain = mapping.get(
            "uncertain"
        )

        if not isinstance(
            uncertain,
            dict,
        ):
            raise ValueError(
                "uncertain inválido "
                "no class_mapping.json."
            )

        self._uncertain_threshold = float(
            uncertain.get(
                "threshold",
                0.5,
            )
        )

        if not (
            0.0
            <= self._uncertain_threshold
            <= 1.0
        ):
            raise ValueError(
                "O threshold UNCERTAIN "
                "deve estar entre 0 e 1."
            )

        input_config = mapping.get(
            "input"
        )

        if not isinstance(
            input_config,
            dict,
        ):
            raise ValueError(
                "input inválido "
                "no class_mapping.json."
            )

        color_mode = input_config.get(
            "colorMode"
        )

        if color_mode != "RGB":
            raise ValueError(
                "Este classificador "
                "espera colorMode RGB."
            )

        input_size = input_config.get(
            "size"
        )

        if (
            not isinstance(
                input_size,
                list,
            )
            or len(
                input_size
            )
            != 2
        ):
            raise ValueError(
                "input.size inválido "
                "no class_mapping.json."
            )

        self._input_height = int(
            input_size[0]
        )

        self._input_width = int(
            input_size[1]
        )

        if (
            self._input_height
            != 224
            or self._input_width
            != 224
        ):
            raise ValueError(
                "Este classificador espera "
                "entrada 224x224."
            )

        self._normalization_mean = (
            self._parse_normalization(
                input_config.get(
                    "normalizationMean"
                ),
                field_name=(
                    "normalizationMean"
                ),
            )
        )

        self._normalization_std = (
            self._parse_normalization(
                input_config.get(
                    "normalizationStd"
                ),
                field_name=(
                    "normalizationStd"
                ),
            )
        )

        if np.any(
            self._normalization_std
            <= 0
        ):
            raise ValueError(
                "normalizationStd deve "
                "possuir somente valores "
                "positivos."
            )

        self._session = (
            ort.InferenceSession(
                str(
                    self._model_path
                ),
                providers=[
                    "CPUExecutionProvider",
                ],
            )
        )

        session_inputs = (
            self._session
            .get_inputs()
        )

        session_outputs = (
            self._session
            .get_outputs()
        )

        if len(
            session_inputs
        ) != 1:
            raise ValueError(
                "O modelo visual deve "
                "possuir exatamente "
                "uma entrada."
            )

        if len(
            session_outputs
        ) < 1:
            raise ValueError(
                "O modelo visual não possui "
                "saída utilizável."
            )

        self._input_name = (
            session_inputs[
                0
            ].name
        )

        self._output_name = (
            session_outputs[
                0
            ].name
        )

    @property
    def model_name(
        self,
    ) -> str:
        return self._model_name

    @property
    def model_version(
        self,
    ) -> str:
        return self._model_version

    @staticmethod
    def _load_mapping(
        path: Path,
    ) -> dict[str, object]:
        if not path.is_file():
            raise FileNotFoundError(
                "class_mapping.json "
                f"não encontrado: {path}"
            )

        with path.open(
            "r",
            encoding="utf-8",
        ) as file:
            mapping = json.load(
                file
            )

        if not isinstance(
            mapping,
            dict,
        ):
            raise ValueError(
                "class_mapping.json "
                "deve conter um objeto JSON."
            )

        required_fields = {
            "modelName",
            "modelVersion",
            "indexToLabel",
            "uncertain",
            "input",
        }

        missing_fields = (
            required_fields
            - set(
                mapping
            )
        )

        if missing_fields:
            raise ValueError(
                "class_mapping.json "
                "incompleto. Campos "
                "ausentes: "
                + ", ".join(
                    sorted(
                        missing_fields
                    )
                )
            )

        return mapping

    @staticmethod
    def _parse_index_to_label(
        raw_mapping: object,
    ) -> dict[int, VisualLabel]:
        if not isinstance(
            raw_mapping,
            dict,
        ):
            raise ValueError(
                "indexToLabel deve ser "
                "um objeto JSON."
            )

        parsed: dict[
            int,
            VisualLabel,
        ] = {}

        for (
            raw_index,
            raw_label,
        ) in raw_mapping.items():
            index = int(
                raw_index
            )

            label = str(
                raw_label
            )

            if label not in (
                SUPPORTED_MODEL_LABELS
            ):
                raise ValueError(
                    "Classe visual não "
                    "suportada no modelo: "
                    f"{label}"
                )

            parsed[
                index
            ] = cast(
                VisualLabel,
                label,
            )

        expected_indices = set(
            range(
                len(
                    SUPPORTED_MODEL_LABELS
                )
            )
        )

        if (
            set(
                parsed
            )
            != expected_indices
        ):
            raise ValueError(
                "Os índices das classes "
                "do modelo devem ser "
                "contíguos a partir de 0."
            )

        return parsed

    @staticmethod
    def _parse_normalization(
        raw_values: object,
        *,
        field_name: str,
    ) -> np.ndarray:
        if (
            not isinstance(
                raw_values,
                list,
            )
            or len(
                raw_values
            )
            != 3
        ):
            raise ValueError(
                f"{field_name} deve "
                "possuir três valores."
            )

        values = np.asarray(
            raw_values,
            dtype=np.float32,
        )

        if not np.isfinite(
            values
        ).all():
            raise ValueError(
                f"{field_name} contém "
                "valor não finito."
            )

        return values.reshape(
            3,
            1,
            1,
        )

    @staticmethod
    def _softmax(
        logits: np.ndarray,
    ) -> np.ndarray:
        logits = np.asarray(
            logits,
            dtype=np.float32,
        )

        if not np.isfinite(
            logits
        ).all():
            raise ValueError(
                "O modelo produziu logits "
                "não finitos."
            )

        shifted = (
            logits
            - np.max(
                logits
            )
        )

        exponentials = np.exp(
            shifted
        )

        denominator = np.sum(
            exponentials
        )

        if (
            not np.isfinite(
                denominator
            )
            or denominator <= 0
        ):
            raise ValueError(
                "Softmax produziu "
                "resultado inválido."
            )

        probabilities = (
            exponentials
            / denominator
        )

        if not np.isfinite(
            probabilities
        ).all():
            raise ValueError(
                "Softmax produziu "
                "probabilidades inválidas."
            )

        return probabilities

    @staticmethod
    def _resize_shorter_side(
        image: Image.Image,
        shorter_side: int,
    ) -> Image.Image:
        width, height = (
            image.size
        )

        if (
            width <= 0
            or height <= 0
        ):
            raise ValueError(
                "Dimensões inválidas "
                "da imagem."
            )

        if width < height:
            new_width = (
                shorter_side
            )

            new_height = int(
                shorter_side
                * height
                / width
            )

        else:
            new_height = (
                shorter_side
            )

            new_width = int(
                shorter_side
                * width
                / height
            )

        return image.resize(
            (
                new_width,
                new_height,
            ),
            resample=(
                Image.Resampling.BILINEAR
            ),
        )

    def _center_crop(
        self,
        image: Image.Image,
    ) -> Image.Image:
        width, height = (
            image.size
        )

        left = int(
            round(
                (
                    width
                    - self._input_width
                )
                / 2.0
            )
        )

        top = int(
            round(
                (
                    height
                    - self._input_height
                )
                / 2.0
            )
        )

        right = (
            left
            + self._input_width
        )

        bottom = (
            top
            + self._input_height
        )

        return image.crop(
            (
                left,
                top,
                right,
                bottom,
            )
        )

    def _preprocess(
        self,
        image_bytes: bytes,
        content_type: str,
    ) -> np.ndarray:
        if not image_bytes:
            raise ValueError(
                "Imagem vazia."
            )

        with Image.open(
            BytesIO(
                image_bytes
            )
        ) as image:
            actual_format = (
                image.format
            )

            if (
                actual_format
                not in PIL_FORMAT_TO_MIME
            ):
                raise ValueError(
                    "Formato real da imagem "
                    "não é suportado."
                )

            actual_mime = (
                PIL_FORMAT_TO_MIME[
                    actual_format
                ]
            )

            if (
                actual_mime
                != content_type
            ):
                raise ValueError(
                    "O Content-Type informado "
                    "não corresponde ao formato "
                    "real da imagem."
                )

            image.load()

            image = image.convert(
                "RGB"
            )

            image = (
                self._resize_shorter_side(
                    image,
                    self.RESIZE_SHORTER_SIDE,
                )
            )

            image = self._center_crop(
                image
            )

            array = np.asarray(
                image,
                dtype=np.float32,
            )

        expected_shape = (
            self._input_height,
            self._input_width,
            3,
        )

        if (
            array.shape
            != expected_shape
        ):
            raise ValueError(
                "Formato inesperado após "
                "pré-processamento: "
                f"{array.shape}"
            )

        array = (
            array
            / 255.0
        )

        array = np.transpose(
            array,
            (
                2,
                0,
                1,
            ),
        )

        array = (
            array
            - self._normalization_mean
        ) / self._normalization_std

        array = np.expand_dims(
            array,
            axis=0,
        )

        return np.ascontiguousarray(
            array,
            dtype=np.float32,
        )

    def _run_inference(
        self,
        model_input: np.ndarray,
    ) -> list:
        try:
            return self._session.run(
                [
                    self._output_name,
                ],
                {
                    self._input_name: (
                        model_input
                    ),
                },
            )

        except Exception as error:
            raise RuntimeError(
                "Falha durante a execução "
                "do modelo ONNX."
            ) from error

    @staticmethod
    def _explanation_for(
        label: VisualLabel,
        confidence: float,
    ) -> str:
        confidence_percent = (
            confidence
            * 100
        )

        if (
            label
            == "FLOOD_WATER"
        ):
            return (
                "O modelo visual identificou "
                "evidências compatíveis com "
                "presença de água em cenário "
                "de inundação, enxurrada ou "
                "alagamento "
                f"({confidence_percent:.1f}% "
                "de confiança). "
                "A categoria COBRADE exata "
                "deve ser definida na "
                "validação humana."
            )

        if (
            label
            == "FIRE_SMOKE"
        ):
            return (
                "O modelo visual identificou "
                "evidências compatíveis com "
                "fogo e/ou fumaça "
                f"({confidence_percent:.1f}% "
                "de confiança). "
                "A categoria COBRADE exata "
                "deve ser definida na "
                "validação humana."
            )

        if (
            label
            == "OTHER"
        ):
            return (
                "O modelo visual não "
                "identificou evidência "
                "suficiente das classes "
                "FLOOD_WATER ou FIRE_SMOKE "
                f"({confidence_percent:.1f}% "
                "de confiança para OTHER). "
                "A decisão final permanece "
                "humana."
            )

        return (
            "O modelo visual processou a "
            "imagem, mas a confiança máxima "
            f"foi de {confidence_percent:.1f}%, "
            "abaixo do limiar configurado. "
            "O resultado foi marcado como "
            "UNCERTAIN e deve ser revisado "
            "por uma pessoa."
        )

    def classify(
        self,
        *,
        image_bytes: bytes,
        content_type: str,
    ) -> VisualClassificationResult:
        if (
            content_type
            not in ALLOWED_IMAGE_MIME_TYPES
        ):
            return VisualClassificationResult(
                result_status="ERROR",
                predicted_label=None,
                confidence=None,
                candidate_cobrade_codes=(),
                explanation_simple=(
                    "O tipo de imagem "
                    "informado não é "
                    "suportado pelo "
                    "modelo visual."
                ),
                model_name=(
                    self._model_name
                ),
                model_version=(
                    self._model_version
                ),
                synthetic_data=False,
            )

        try:
            model_input = (
                self._preprocess(
                    image_bytes,
                    content_type,
                )
            )

            outputs = (
                self._run_inference(
                    model_input
                )
            )

            if not outputs:
                raise ValueError(
                    "O modelo ONNX não "
                    "retornou nenhuma saída."
                )

            logits = np.asarray(
                outputs[0],
                dtype=np.float32,
            )

            if (
                logits.ndim != 2
                or logits.shape[0]
                != 1
                or logits.shape[1]
                != len(
                    self._index_to_label
                )
            ):
                raise ValueError(
                    "Formato inesperado "
                    "da saída ONNX: "
                    f"{logits.shape}"
                )

            probabilities = (
                self._softmax(
                    logits[0]
                )
            )

            predicted_index = int(
                np.argmax(
                    probabilities
                )
            )

            confidence = float(
                probabilities[
                    predicted_index
                ]
            )

            if (
                confidence
                < self._uncertain_threshold
            ):
                predicted_label: (
                    VisualLabel
                ) = "UNCERTAIN"

            else:
                predicted_label = (
                    self._index_to_label[
                        predicted_index
                    ]
                )

            return VisualClassificationResult(
                result_status="AVAILABLE",
                predicted_label=(
                    predicted_label
                ),
                confidence=confidence,
                candidate_cobrade_codes=(
                    CANDIDATE_COBRADE_CODES[
                        predicted_label
                    ]
                ),
                explanation_simple=(
                    self._explanation_for(
                        predicted_label,
                        confidence,
                    )
                ),
                model_name=(
                    self._model_name
                ),
                model_version=(
                    self._model_version
                ),
                synthetic_data=False,
            )

        except (
            UnidentifiedImageError,
            OSError,
            ValueError,
            RuntimeError,
        ) as error:
            logger.warning(
                "Falha na inferência "
                "visual: %s",
                error,
            )

            return VisualClassificationResult(
                result_status="ERROR",
                predicted_label=None,
                confidence=None,
                candidate_cobrade_codes=(),
                explanation_simple=(
                    "Não foi possível "
                    "processar a imagem "
                    "com o modelo visual."
                ),
                model_name=(
                    self._model_name
                ),
                model_version=(
                    self._model_version
                ),
                synthetic_data=False,
            )


def build_visual_classifier() -> VisualClassifier:
    if not VISUAL_MODEL_PATH.is_file():
        logger.warning(
            "Modelo visual ONNX não "
            "encontrado em %s.",
            VISUAL_MODEL_PATH,
        )

        return (
            UnavailableVisualClassifier()
        )

    if (
        not VISUAL_CLASS_MAPPING_PATH
        .is_file()
    ):
        logger.warning(
            "class_mapping.json não "
            "encontrado em %s.",
            VISUAL_CLASS_MAPPING_PATH,
        )

        return (
            UnavailableVisualClassifier()
        )

    try:
        classifier = (
            OnnxVisualClassifier(
                model_path=(
                    VISUAL_MODEL_PATH
                ),
                class_mapping_path=(
                    VISUAL_CLASS_MAPPING_PATH
                ),
            )
        )

    except Exception:
        logger.exception(
            "Não foi possível "
            "inicializar o modelo "
            "visual ONNX."
        )

        return (
            UnavailableVisualClassifier()
        )

    logger.info(
        "Modelo visual carregado: "
        "%s %s.",
        classifier.model_name,
        classifier.model_version,
    )

    return classifier


visual_classifier: VisualClassifier = (
    build_visual_classifier()
)