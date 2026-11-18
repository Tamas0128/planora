"""Egyszerű SMTP e-mail küldés — dev/teszt módban Mailpit-re megy (lásd
docker-compose.yml), nem valódi postafiókra. `settings.smtp_host` üresen
hagyása esetén nem küld: naplóz és False-t ad vissza, hogy a hívó ne
rögzítsen "elküldött" levelet, ami valójában nem ment el."""

import logging
import smtplib
from email.mime.text import MIMEText

from app.config import settings

logger = logging.getLogger("ubrankovics.email")


def _header_safe(value: str) -> str:
    # CR/LF a fejlécben új fejlécet (pl. Bcc:) csempészhetne be.
    return " ".join(value.replace("\r", " ").replace("\n", " ").split())


def send_email(to: str, subject: str, html_body: str) -> bool:
    """True, ha a levelet átadtuk az SMTP szervernek; False, ha az SMTP nincs
    beállítva. Kapcsolati/hitelesítési hibánál kivételt dob."""
    if not settings.smtp_host:
        logger.warning("SMTP_HOST not set — email not sent (subject=%r, to=%r)", subject, to)
        return False

    to = _header_safe(to)
    msg = MIMEText(html_body, "html", "utf-8")
    msg["Subject"] = _header_safe(subject)
    msg["From"] = settings.smtp_from
    msg["To"] = to

    with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=10) as server:
        if settings.smtp_use_tls:
            server.starttls()
        if settings.smtp_user:
            server.login(settings.smtp_user, settings.smtp_password)
        server.sendmail(settings.smtp_from, [to], msg.as_string())
    return True
