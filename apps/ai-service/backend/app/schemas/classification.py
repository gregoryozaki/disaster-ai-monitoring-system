from typing import Literal

from pydantic import BaseModel, Field


AIResultStatus = Literal[
    "AVAILABLE",
    "UNAVAILABLE",
    "ERROR",
]

AIModelType = Literal[
    "VISUAL",
    "TEXTUAL",
    "MULTIMODAL",
    "RISK_PREDICTION",
]


class ModelInfo(BaseModel):
    modelType: AIModelType
    name: str
    version: str
    syntheticData: bool = False


class ClassifyResponse(BaseModel):
    resultStatus: AIResultStatus

    predictedCobradeCode: str | None = None

    # Score principal da modalidade responsável
    # pela resposta.
    #
    # Para MULTIMODAL, será mantido como None
    # até existir um score multimodal
    # metodologicamente definido e calibrado.
    confidence: float | None = Field(
        default=None,
        ge=0,
        le=1,
    )

    # Scores individuais das modalidades.
    # Eles são mantidos separados porque os
    # classificadores visual e textual possuem
    # espaços de saída diferentes.
    visualConfidence: float | None = Field(
        default=None,
        ge=0,
        le=1,
    )

    textConfidence: float | None = Field(
        default=None,
        ge=0,
        le=1,
    )

    # Indica que a pré-análise não conseguiu
    # produzir uma decisão sem ambiguidade.
    #
    # Na futura fusão, isso será utilizado
    # principalmente para conflitos e evidência
    # multimodal parcial.
    ambiguous: bool = False

    ambiguityReason: str | None = None

    explanationSimple: str

    model: ModelInfo

    signals: dict[str, object]