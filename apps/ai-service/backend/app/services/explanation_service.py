from app.schemas.explanation import ExplainRequest


def explain_result(
    payload: ExplainRequest,
) -> dict[str, object]:
    """
    Informa a disponibilidade das técnicas de
    explicabilidade pós-hoc do protótipo.

    Importante:
    - explanationSimple, retornado pelos fluxos de
      classificação e previsão, é uma explicação
      textual simplificada;
    - explanationSimple não deve ser interpretado
      como Grad-CAM, SHAP, LIME ou outra técnica
      quantitativa de XAI.
    """

    if payload.target == "visual_classification":
        return {
            "target": "visual_classification",
            "method": "Grad-CAM",
            "available": False,
            "reason": "NOT_IMPLEMENTED",
            "message": (
                "O classificador visual está integrado e operacional, "
                "mas Grad-CAM ainda não foi implementado para o modelo "
                "visual utilizado pelo protótipo. A classificação possui "
                "uma explicação textual simplificada, que não corresponde "
                "a um mapa de ativação Grad-CAM."
            ),
        }

    return {
        "target": "risk_prediction",
        "method": "SHAP",
        "available": False,
        "reason": "NOT_APPLICABLE_TO_CURRENT_BASELINE",
        "message": (
            "SHAP não é disponibilizado para a previsão de risco atual. "
            "O componente de previsão utiliza um baseline sintético baseado "
            "em regras fixas, e não um modelo preditivo treinado sobre "
            "variáveis ambientais reais. Os fatores retornados por /predict "
            "descrevem o cenário sintético e não representam atribuições "
            "quantitativas de características."
        ),
    }