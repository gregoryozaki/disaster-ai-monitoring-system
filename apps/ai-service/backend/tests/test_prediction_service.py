from app.schemas.prediction import PredictRequest
from app.services.prediction_service import (
    MODEL_VERSION,
    predict_risk,
)


def test_hydrological_prediction_is_synthetic() -> None:
    result = predict_risk(
        PredictRequest(
            region="Manaus - AM / Centro",
            disaster_type="INUNDACAO_ALAGAMENTO",
            horizon_hours=48,
        )
    )

    assert result.riskLevel == "HIGH"
    assert result.probability == 0.78
    assert result.trend == "INCREASING"
    assert result.synthetic is True
    assert result.modelVersion == MODEL_VERSION

    assert (
        "sem dados ambientais reais"
        in result.factors
    )


def test_fire_prediction_is_synthetic() -> None:
    result = predict_risk(
        PredictRequest(
            region="Manaus - AM / Zona Norte",
            disaster_type="INCENDIO_QUEIMADA",
            horizon_hours=48,
        )
    )

    assert result.riskLevel == "MEDIUM"
    assert result.probability == 0.57
    assert result.trend == "STABLE"
    assert result.synthetic is True
    assert result.modelVersion == MODEL_VERSION