from app.schemas.prediction import (
    PredictRequest,
    PredictionResponse,
)


MODEL_VERSION = "kamara_synthetic_risk_baseline@0.1.0"


def predict_risk(
    payload: PredictRequest,
) -> PredictionResponse:
    """
    Baseline sintético utilizado apenas para demonstrar
    o contrato arquitetural de previsão de risco.

    Nesta versão, região e horizonte são preservados na
    requisição, mas não alteram numericamente o resultado.

    Não utiliza:
    - dados meteorológicos reais;
    - dados hidrológicos reais;
    - histórico real de ocorrências;
    - modelo estatístico ou de machine learning treinado.
    """

    hydrological_risk = (
        payload.disaster_type
        == "INUNDACAO_ALAGAMENTO"
    )

    return PredictionResponse(
        riskLevel=(
            "HIGH"
            if hydrological_risk
            else "MEDIUM"
        ),
        probability=(
            0.78
            if hydrological_risk
            else 0.57
        ),
        trend=(
            "INCREASING"
            if hydrological_risk
            else "STABLE"
        ),
        factors=[
            "cenário sintético de demonstração",
            "regra fixa por família de desastre",
            "sem dados ambientais reais",
        ],
        explanationSimple=(
            "Estimativa sintética e experimental para "
            "demonstração da arquitetura de apoio à decisão. "
            "Não constitui alerta oficial."
        ),
        synthetic=True,
        modelVersion=MODEL_VERSION,
    )