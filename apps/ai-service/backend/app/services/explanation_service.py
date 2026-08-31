from app.schemas.explanation import ExplainRequest


def explain_result(
    payload: ExplainRequest,
) -> dict[str, object]:
    if payload.target == "visual_classification":
        return {
            "method": "Grad-CAM",
            "available": False,
            "message": (
                "O modelo visual real ainda não foi integrado."
            ),
        }

    return {
        "method": "SHAP",
        "available": True,
        "factors": [
            {
                "name": "precipitacao",
                "contribution": 0.34,
            },
            {
                "name": "historico regional",
                "contribution": 0.27,
            },
            {
                "name": "ocorrencias recentes",
                "contribution": 0.18,
            },
        ],
        "message": (
            "Contribuições mockadas para explicar "
            "previsão experimental."
        ),
    }