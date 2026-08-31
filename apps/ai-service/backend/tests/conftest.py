import pytest

import app.services.classification_service as classification_service_module

from app.models.text_classifier import (
    UnavailableTextClassifier,
)

from app.models.visual_classifier import (
    UnavailableVisualClassifier,
)


@pytest.fixture(autouse=True)
def use_unavailable_models_by_default(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """
    A suíte geral não depende dos
    artefatos reais de ML.

    Os testes específicos podem injetar
    doubles de VisualClassifier e
    TextClassifier explicitamente.
    """

    monkeypatch.setattr(
        classification_service_module,
        "visual_classifier",
        UnavailableVisualClassifier(),
    )

    monkeypatch.setattr(
        classification_service_module,
        "get_text_classifier",
        lambda: UnavailableTextClassifier(),
    )