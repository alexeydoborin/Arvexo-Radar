import time

import pytest

from app.domain.masking import mask_text


def test_masks_email() -> None:
    result = mask_text("Напиши ответ для user@example.com по задаче")
    assert "user@example.com" not in result.masked_text
    assert "[EMAIL_1]" in result.masked_text
    assert result.findings[0].kind == "EMAIL"


def test_masks_phone() -> None:
    result = mask_text("Позвони мне на +7 999 123-45-67 сегодня")
    assert "999 123-45-67" not in result.masked_text
    assert "[PHONE_1]" in result.masked_text


def test_masks_secret_like_token() -> None:
    result = mask_text("ключ sk-abcdefghij1234567890 не публикуй")
    assert "sk-abcdefghij1234567890" not in result.masked_text
    assert "[SECRET_1]" in result.masked_text


def test_no_false_positive_on_plain_text() -> None:
    result = mask_text("Собери сводку писем за день")
    assert result.masked_text == "Собери сводку писем за день"
    assert result.findings == ()


def test_multiple_findings_get_incrementing_placeholders() -> None:
    result = mask_text("a@b.com и c@d.com")
    assert "[EMAIL_1]" in result.masked_text
    assert "[EMAIL_2]" in result.masked_text


def test_email_sharing_characters_with_neighbouring_text() -> None:
    result = mask_text("x@foo@bar.com, (ivan.petrov+ai@corp-mail.ru)")
    assert result.masked_text == "x@[EMAIL_1], ([EMAIL_2])"


@pytest.mark.parametrize(
    "adversarial",
    [
        "a" * 2_000_000,
        "a" * 1_000_000 + "@" + "a" * 1_000_000,
        "a@" + "a." * 1_000_000,
        "1" * 2_000_000 + "a",
    ],
    ids=["word-run", "at-in-run", "dotted-domain", "digit-run"],
)
def test_masking_is_linear_on_max_length_rows(adversarial: str) -> None:
    # The previous single email regex was quadratic: a 2M-char row (the
    # max_row_chars limit) took ~40 minutes of CPU inside the upload request.
    started = time.perf_counter()
    mask_text(adversarial)
    assert time.perf_counter() - started < 2
