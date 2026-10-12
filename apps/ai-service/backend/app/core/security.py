import os
import secrets

from typing import Annotated

from fastapi import (
    Header,
    HTTPException,
    status,
)


API_KEY_ENV_NAME = "KAMARA_AI_SERVICE_API_KEY"


def require_internal_api_key(
    x_internal_api_key: Annotated[
        str | None,
        Header(),
    ] = None,
) -> None:
    """
    Exige a chave compartilhada com a API Express
    (header X-Internal-Api-Key).

    Se KAMARA_AI_SERVICE_API_KEY não estiver definida,
    a verificação fica desligada, para não quebrar
    o desenvolvimento local e a suíte de testes.
    """

    expected = os.getenv(API_KEY_ENV_NAME)

    if not expected:
        return

    if x_internal_api_key is None or not secrets.compare_digest(
        x_internal_api_key.encode(),
        expected.encode(),
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Chave interna inválida ou ausente.",
        )
