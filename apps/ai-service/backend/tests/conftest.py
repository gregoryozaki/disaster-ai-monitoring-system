import pytest

import app.services.classification_service as classification_service_module

from app.models.text_classifier import (
    UnavailableTextClassifier,
)

from app.models.visual_classifier import (
    UnavailableVisualClassifier,
)

from app.core.security import API_KEY_ENV_NAME


@pytest.fixture(autouse=True)
def disable_internal_api_key_by_default(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """
    A suíte não depende da chave interna
    configurada no ambiente (por exemplo,
    dentro do container do docker-compose).

    Os testes de autenticação definem a
    chave explicitamente.
    """

    monkeypatch.delenv(
        API_KEY_ENV_NAME,
        raising=False,
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
