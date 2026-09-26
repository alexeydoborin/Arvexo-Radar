import os

import pytest

# Authentication fails closed unless it is disabled explicitly; unit tests run
# as the local developer principal unless a test configures a session secret.
os.environ["ARVEXO_AUTH_MODE"] = "none"


@pytest.fixture(autouse=True)
def _reset_write_rate_limit():
    from app.api.security import write_limiter

    write_limiter.reset()
    yield
    write_limiter.reset()
