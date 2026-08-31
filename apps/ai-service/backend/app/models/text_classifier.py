from __future__ import annotations

import json
import logging

from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import (
    Literal,
    Protocol,
    cast,
)

import torch

from transformers import (
    AutoModelForSequenceClassification,
    AutoTokenizer,
)

from app.core.model_config import (
    NLP_DEVICE,
    NLP_MODEL_DIR,
    NLP_RUN_METADATA_PATH,
)

from app.schemas.classification import (
    AIResultStatus,
)


logger = logging.getLogger(
    __name__
)


TextLabel = Literal[
    "COBRADE_1_2_1_0_0",
    "COBRADE_1_2_2_0_0",
    "COBRADE_1_2_3_0_0",
    "COBRADE_1_4_1_3_1",
    "COBRADE_1_4_1_3_2",
    "COBRADE_2_3_1_1_0",
    "COBRADE_2_3_1_2_0",
    "OTHER",
    "INSUFFICIENT_INFO",
]


SUPPORTED_TEXT_LABELS: tuple[
    TextLabel,
    ...,
] = (
    "COBRADE_1_2_1_0_0",
    "COBRADE_1_2_2_0_0",
    "COBRADE_1_2_3_0_0",
    "COBRADE_1_4_1_3_1",
    "COBRADE_1_4_1_3_2",
    "COBRADE_2_3_1_1_0",
    "COBRADE_2_3_1_2_0",
    "OTHER",
    "INSUFFICIENT_INFO",
)


@dataclass(frozen=True)
class TextClassificationResult:
    result_status: AIResultStatus

    predicted_label: TextLabel | None

    confidence: float | None

    probabilities: dict[
        TextLabel,
        float,
    ]

    explanation_simple: str

    model_name: str

    model_version: str

    synthetic_data: bool


class TextClassifier(Protocol):
    def classify(
        self,
        *,
        text: str,
    ) -> TextClassificationResult:
        ...


class UnavailableTextClassifier:
    """
    Fallback utilizado quando o artefato
    textual não pode ser carregado.
    """

    def classify(
        self,
        *,
        text: str,
    ) -> TextClassificationResult:
        return TextClassificationResult(
            result_status="UNAVAILABLE",
            predicted_label=None,
            confidence=None,
            probabilities={},
            explanation_simple=(
                "O texto foi recebido, mas "
                "o modelo textual não está "
                "disponível para inferência."
            ),
            model_name=(
                "text-model-unavailable"
            ),
            model_version="0.0.0",
            synthetic_data=True,
        )


class BertimbauTextClassifier:
    """
    Classificador textual do KAMARA
    baseado em BERTimbau.

    A inferência replica o procedimento
    utilizado na avaliação independente
    do artefato congelado:

    1. preserva o texto recebido;
    2. tokeniza sem lowercase manual;
    3. aplica truncation;
    4. aplica padding até max_length;
    5. executa o modelo em modo eval;
    6. usa torch.inference_mode();
    7. aplica softmax aos logits;
    8. resolve a classe por id2label.
    """

    def __init__(
        self,
        *,
        model_dir: Path,
        run_metadata_path: Path,
        device: str = "cpu",
    ) -> None:
        self._model_dir = (
            model_dir.resolve()
        )

        self._run_metadata_path = (
            run_metadata_path.resolve()
        )

        run_metadata = (
            self._load_run_metadata(
                self._run_metadata_path
            )
        )

        self._model_name = self._required_string(
            run_metadata,
            "run_name",
        )

        self._model_version = (
            self._required_string(
                run_metadata,
                "dataset_iteration",
            )
        )

        self._max_length = (
            self._required_positive_integer(
                run_metadata,
                "max_length",
            )
        )

        self._device = self._resolve_device(
            device
        )

        self._tokenizer = (
            AutoTokenizer.from_pretrained(
                self._model_dir,
                local_files_only=True,
            )
        )

        self._model = (
            AutoModelForSequenceClassification
            .from_pretrained(
                self._model_dir,
                local_files_only=True,
            )
        )

        self._id2label = (
            self._parse_id2label()
        )

        max_position_embeddings = getattr(
            self._model.config,
            "max_position_embeddings",
            None,
        )

        if (
            isinstance(
                max_position_embeddings,
                int,
            )
            and self._max_length
            > max_position_embeddings
        ):
            raise ValueError(
                "max_length do artefato excede "
                "max_position_embeddings do modelo."
            )

        self._model.to(
            self._device
        )

        self._model.eval()

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

    @property
    def max_length(
        self,
    ) -> int:
        return self._max_length

    @staticmethod
    def _load_run_metadata(
        path: Path,
    ) -> dict[str, object]:
        if not path.is_file():
            raise FileNotFoundError(
                "run_metadata.json do modelo "
                f"textual não encontrado: {path}"
            )

        with path.open(
            "r",
            encoding="utf-8",
        ) as file:
            metadata = json.load(
                file
            )

        if not isinstance(
            metadata,
            dict,
        ):
            raise ValueError(
                "run_metadata.json deve "
                "conter um objeto JSON."
            )

        return metadata

    @staticmethod
    def _required_string(
        metadata: dict[str, object],
        field_name: str,
    ) -> str:
        value = metadata.get(
            field_name
        )

        if (
            not isinstance(
                value,
                str,
            )
            or not value.strip()
        ):
            raise ValueError(
                f"{field_name} ausente ou "
                "inválido no run_metadata.json."
            )

        return value.strip()

    @staticmethod
    def _required_positive_integer(
        metadata: dict[str, object],
        field_name: str,
    ) -> int:
        value = metadata.get(
            field_name
        )

        if (
            not isinstance(
                value,
                int,
            )
            or isinstance(
                value,
                bool,
            )
            or value <= 0
        ):
            raise ValueError(
                f"{field_name} ausente ou "
                "inválido no run_metadata.json."
            )

        return value

    @staticmethod
    def _resolve_device(
        raw_device: str,
    ) -> torch.device:
        try:
            device = torch.device(
                raw_device
            )
        except (
            RuntimeError,
            ValueError,
        ) as error:
            raise ValueError(
                "KAMARA_NLP_DEVICE inválido: "
                f"{raw_device!r}."
            ) from error

        if (
            device.type == "cuda"
            and not torch.cuda.is_available()
        ):
            raise RuntimeError(
                "KAMARA_NLP_DEVICE solicita CUDA, "
                "mas CUDA não está disponível."
            )

        return device

    def _parse_id2label(
        self,
    ) -> dict[int, TextLabel]:
        raw_mapping = getattr(
            self._model.config,
            "id2label",
            None,
        )

        if not isinstance(
            raw_mapping,
            dict,
        ):
            raise ValueError(
                "config.json do modelo "
                "não contém id2label válido."
            )

        num_labels = getattr(
            self._model.config,
            "num_labels",
            None,
        )

        if (
            not isinstance(
                num_labels,
                int,
            )
            or num_labels <= 0
        ):
            raise ValueError(
                "num_labels inválido "
                "na configuração do modelo."
            )

        parsed: dict[
            int,
            TextLabel,
        ] = {}

        for (
            raw_index,
            raw_label,
        ) in raw_mapping.items():
            try:
                index = int(
                    raw_index
                )
            except (
                TypeError,
                ValueError,
            ) as error:
                raise ValueError(
                    "id2label contém "
                    "índice inválido."
                ) from error

            label = str(
                raw_label
            )

            if (
                label
                not in SUPPORTED_TEXT_LABELS
            ):
                raise ValueError(
                    "Classe textual não "
                    "suportada no modelo: "
                    f"{label}"
                )

            parsed[
                index
            ] = cast(
                TextLabel,
                label,
            )

        expected_indices = set(
            range(
                num_labels
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
                "textuais devem ser "
                "contíguos a partir de 0."
            )

        if (
            set(
                parsed.values()
            )
            != set(
                SUPPORTED_TEXT_LABELS
            )
        ):
            raise ValueError(
                "As classes do artefato "
                "não correspondem às nove "
                "classes esperadas pelo KAMARA."
            )

        return parsed

    @staticmethod
    def _explanation_for(
        label: TextLabel,
        confidence: float,
    ) -> str:
        probability_percent = (
            confidence
            * 100
        )

        if (
            label
            == "INSUFFICIENT_INFO"
        ):
            return (
                "O modelo textual classificou "
                "o relato como informação "
                "insuficiente para selecionar "
                "uma categoria COBRADE exata "
                f"({probability_percent:.1f}% "
                "de probabilidade máxima). "
                "A decisão final permanece humana."
            )

        if label == "OTHER":
            return (
                "O modelo textual classificou "
                "o relato como um evento fora "
                "das categorias COBRADE "
                "contempladas pelo classificador "
                f"({probability_percent:.1f}% "
                "de probabilidade máxima). "
                "A decisão final permanece humana."
            )

        return (
            "O modelo textual BERTimbau "
            "produziu uma sugestão de "
            "categoria COBRADE "
            f"({probability_percent:.1f}% "
            "de probabilidade máxima). "
            "A decisão final permanece humana."
        )

    def classify(
        self,
        *,
        text: str,
    ) -> TextClassificationResult:
        stripped_text = (
            text.strip()
        )

        if not stripped_text:
            return TextClassificationResult(
                result_status="UNAVAILABLE",
                predicted_label=None,
                confidence=None,
                probabilities={},
                explanation_simple=(
                    "Nenhum texto utilizável "
                    "foi fornecido para o "
                    "modelo textual."
                ),
                model_name=(
                    self._model_name
                ),
                model_version=(
                    self._model_version
                ),
                synthetic_data=True,
            )

        try:
            encoded = self._tokenizer(
                stripped_text,
                truncation=True,
                padding="max_length",
                max_length=(
                    self._max_length
                ),
                return_tensors="pt",
            )

            batch = {
                key: value.to(
                    self._device
                )
                for key, value
                in encoded.items()
            }

            with torch.inference_mode():
                outputs = self._model(
                    **batch
                )

                probabilities_tensor = (
                    torch.softmax(
                        outputs.logits,
                        dim=-1,
                    )
                )

            expected_shape = (
                1,
                len(
                    self._id2label
                ),
            )

            if (
                tuple(
                    probabilities_tensor.shape
                )
                != expected_shape
            ):
                raise ValueError(
                    "Formato inesperado da "
                    "saída textual: "
                    f"{tuple(probabilities_tensor.shape)}"
                )

            if not bool(
                torch.isfinite(
                    probabilities_tensor
                )
                .all()
                .item()
            ):
                raise ValueError(
                    "O modelo textual produziu "
                    "probabilidades não finitas."
                )

            predicted_id = int(
                probabilities_tensor
                .argmax(
                    dim=-1
                )
                .item()
            )

            predicted_label = (
                self._id2label[
                    predicted_id
                ]
            )

            confidence = float(
                probabilities_tensor[
                    0,
                    predicted_id,
                ].item()
            )

            probabilities: dict[
                TextLabel,
                float,
            ] = {
                label: float(
                    probabilities_tensor[
                        0,
                        class_id,
                    ].item()
                )
                for class_id, label
                in self._id2label.items()
            }

            return TextClassificationResult(
                result_status="AVAILABLE",
                predicted_label=(
                    predicted_label
                ),
                confidence=confidence,
                probabilities=probabilities,
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
                synthetic_data=True,
            )

        except Exception as error:
            logger.warning(
                "Falha na inferência "
                "textual: %s",
                error,
            )

            return TextClassificationResult(
                result_status="ERROR",
                predicted_label=None,
                confidence=None,
                probabilities={},
                explanation_simple=(
                    "Não foi possível "
                    "processar o texto com "
                    "o modelo textual."
                ),
                model_name=(
                    self._model_name
                ),
                model_version=(
                    self._model_version
                ),
                synthetic_data=True,
            )


def build_text_classifier() -> TextClassifier:
    if not NLP_MODEL_DIR.is_dir():
        logger.warning(
            "Diretório do modelo textual "
            "não encontrado em %s.",
            NLP_MODEL_DIR,
        )

        return (
            UnavailableTextClassifier()
        )

    if not NLP_RUN_METADATA_PATH.is_file():
        logger.warning(
            "run_metadata.json do modelo "
            "textual não encontrado em %s.",
            NLP_RUN_METADATA_PATH,
        )

        return (
            UnavailableTextClassifier()
        )

    try:
        classifier = (
            BertimbauTextClassifier(
                model_dir=(
                    NLP_MODEL_DIR
                ),
                run_metadata_path=(
                    NLP_RUN_METADATA_PATH
                ),
                device=NLP_DEVICE,
            )
        )

    except Exception:
        logger.exception(
            "Não foi possível "
            "inicializar o modelo "
            "textual BERTimbau."
        )

        return (
            UnavailableTextClassifier()
        )

    logger.info(
        "Modelo textual carregado: "
        "%s %s.",
        classifier.model_name,
        classifier.model_version,
    )

    return classifier


@lru_cache(maxsize=1)
def get_text_classifier() -> TextClassifier:
    """
    Retorna uma única instância do
    classificador textual por processo.

    O carregamento é lazy: o BERTimbau
    só é inicializado quando realmente
    necessário.
    """

    return build_text_classifier()