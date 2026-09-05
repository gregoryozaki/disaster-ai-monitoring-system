from app.schemas.explanation import ExplainRequest
from app.services.explanation_service import explain_result


def test_visual_explanation_does_not_claim_fake_grad_cam() -> None:
    result = explain_result(
        ExplainRequest(
            target="visual_classification",
            occurrence_id="occurrence-test",
        )
    )

    assert result["target"] == "visual_classification"

    assert result["method"] == "Grad-CAM"

    assert result["available"] is False

    assert result["reason"] == "NOT_IMPLEMENTED"

    message = str(result["message"])

    assert "integrado e operacional" in message

    assert "ainda não foi implementado" in message


def test_risk_explanation_does_not_claim_fake_shap() -> None:
    result = explain_result(
        ExplainRequest(
            target="risk_prediction",
            prediction_id="prediction-test",
        )
    )

    assert result["target"] == "risk_prediction"

    assert result["method"] == "SHAP"

    assert result["available"] is False

    assert (
        result["reason"]
        == "NOT_APPLICABLE_TO_CURRENT_BASELINE"
    )

    message = str(result["message"])

    assert "baseline sintético" in message

    assert (
        "não representam atribuições quantitativas"
        in message
    )


def test_risk_explanation_does_not_return_fake_contributions() -> None:
    result = explain_result(
        ExplainRequest(
            target="risk_prediction",
            prediction_id="prediction-test",
        )
    )

    assert "factors" not in result
    assert "contributions" not in result