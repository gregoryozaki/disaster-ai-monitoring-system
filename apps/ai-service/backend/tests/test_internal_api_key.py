from fastapi.testclient import (
    TestClient,
)

from app.core.security import API_KEY_ENV_NAME
from app.main import app


client = TestClient(
    app
)


def test_classify_is_open_when_key_is_not_configured(monkeypatch):
    monkeypatch.delenv(API_KEY_ENV_NAME, raising=False)

    response = client.post("/classify", data={"text": "rua alagada"})

    assert response.status_code != 401


def test_classify_requires_key_when_configured(monkeypatch):
    monkeypatch.setenv(API_KEY_ENV_NAME, "chave-de-teste-1234567890")

    missing = client.post("/classify", data={"text": "rua alagada"})
    wrong = client.post(
        "/classify",
        data={"text": "rua alagada"},
        headers={"X-Internal-Api-Key": "errada"},
    )
    right = client.post(
        "/classify",
        data={"text": "rua alagada"},
        headers={"X-Internal-Api-Key": "chave-de-teste-1234567890"},
    )

    assert missing.status_code == 401
    assert wrong.status_code == 401
    assert right.status_code != 401


def test_health_stays_open_when_key_is_configured(monkeypatch):
    monkeypatch.setenv(API_KEY_ENV_NAME, "chave-de-teste-1234567890")

    response = client.get("/health")

    assert response.status_code == 200
