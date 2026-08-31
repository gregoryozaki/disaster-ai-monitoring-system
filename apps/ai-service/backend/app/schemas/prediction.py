from typing import Literal

from pydantic import BaseModel, Field


class PredictRequest(BaseModel):
    region: str

    disaster_type: Literal[
        "INCENDIO_QUEIMADA",
        "INUNDACAO_ALAGAMENTO",
    ]

    horizon_hours: int = Field(
        default=48,
        ge=1,
        le=168,
    )


class PredictionResponse(BaseModel):
    riskLevel: Literal[
        "LOW",
        "MEDIUM",
        "HIGH",
    ]

    probability: float = Field(
        ge=0,
        le=1,
    )

    trend: Literal[
        "DECREASING",
        "STABLE",
        "INCREASING",
        "UNKNOWN",
    ]

    factors: list[str]

    explanationSimple: str

    synthetic: bool

    modelVersion: str