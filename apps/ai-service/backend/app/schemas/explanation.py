from typing import Literal

from pydantic import BaseModel


class ExplainRequest(BaseModel):
    target: Literal[
        "visual_classification",
        "risk_prediction",
    ]

    occurrence_id: str | None = None

    prediction_id: str | None = None