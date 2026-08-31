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

    confidence: float | None = Field(
        default=None,
        ge=0,
        le=1,
    )

    explanationSimple: str

    model: ModelInfo

    signals: dict[str, object]