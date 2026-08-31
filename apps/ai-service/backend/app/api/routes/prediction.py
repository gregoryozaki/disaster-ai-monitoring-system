from fastapi import APIRouter

from app.schemas.prediction import (
    PredictRequest,
    PredictionResponse,
)

from app.services.prediction_service import predict_risk


router = APIRouter()


@router.post(
    "/predict",
    response_model=PredictionResponse,
)
def predict(
    payload: PredictRequest,
) -> PredictionResponse:
    return predict_risk(payload)