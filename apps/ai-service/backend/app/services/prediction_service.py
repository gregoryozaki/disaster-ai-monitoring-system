from app.schemas.prediction import (
    PredictRequest,
    PredictionResponse,
)


def predict_risk(
    payload: PredictRequest,
) -> PredictionResponse:
    high_risk = (
        payload.disaster_type
        == "INUNDACAO_ALAGAMENTO"
    )

    return PredictionResponse(
        riskLevel=(
            "HIGH"
            if high_risk
            else "MEDIUM"
        ),
        probability=(
            0.78
            if high_risk
            else 0.57
        ),
        trend=(
            "INCREASING"
            if high_risk
            else "STABLE"
        ),
        factors=[
            "histórico simulado",
            "ocorrências confirmadas",
            "dados ambientais sintéticos",
        ],
        explanationSimple=(
            "Previsão experimental para apoio à decisão, "
            "não alerta oficial."
        ),
        synthetic=True,
        modelVersion="risk-rf@0.1.0",
    )