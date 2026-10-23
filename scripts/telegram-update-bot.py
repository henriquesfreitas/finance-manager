#!/usr/bin/env python3
"""Receive tightly scoped production update commands from Telegram."""

from __future__ import annotations

import json
import logging
import os
import re
import subprocess
import sys
import tempfile
import threading
import time
import urllib.error
import urllib.request
from collections import deque
from dataclasses import dataclass
from pathlib import Path
from typing import Any


PROJECT_DIR = Path(__file__).resolve().parent.parent
ENV_KEYS = ("TELEGRAM_BOT_TOKEN", "TELEGRAM_CHAT_ID", "TELEGRAM_ALLOWED_USER_ID")
MODES = {"frontend", "backend", "both", "both-migrate"}
MODE_SERVICES = {
    "frontend": "client",
    "backend": "server",
    "both": "server and client",
    "both-migrate": "server and client",
}
STEP_LABELS = {
    "pull": "Pulling latest code from origin/master",
    "migrate": "Applying Prisma database migrations",
    "start": "Starting the updated services",
}
HELP_TEXT = (
    "Available commands:\n"
    "/update pull\n"
    "/update restart\n"
    "/update frontend\n"
    "/update backend\n"
    "/update both\n"
    "/update both-migrate\n"
    "/help"
)
LOG = logging.getLogger("telegram_update_bot")


class TelegramApiError(RuntimeError):
    """A Telegram request failed without exposing its token or response body."""


def _read_dotenv(path: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    try:
        lines = path.read_text(encoding="utf-8").splitlines()
    except OSError as error:
        raise ValueError(f"Could not read {path}") from error

    for raw_line in lines:
        line = raw_line.strip()
        if not line or line.startswith("#"):
            continue
        if line.startswith("export "):
            line = line[len("export ") :].lstrip()
        key, separator, value = line.partition("=")
        if not separator or key.strip() not in ENV_KEYS:
            continue
        value = value.strip()
        if len(value) >= 2 and value[0] == value[-1] and value[0] in "\"'":
            value = value[1:-1]
        else:
            value = re.split(r"\s+#", value, maxsplit=1)[0].rstrip()
        values[key.strip()] = value
    return values


@dataclass(frozen=True)
class BotConfig:
    token: str
    chat_id: int
    allowed_user_id: int
    project_dir: Path
    update_script: Path
    offset_path: Path

    @classmethod
    def load(cls, project_dir: Path = PROJECT_DIR) -> "BotConfig":
        file_values = _read_dotenv(project_dir / ".env")
        values = {key: os.environ.get(key, file_values.get(key, "")).strip() for key in ENV_KEYS}
        missing = [key for key, value in values.items() if not value]
        if missing:
            raise ValueError(f"Missing required setting(s): {', '.join(missing)}")
        try:
            chat_id = int(values["TELEGRAM_CHAT_ID"])
            allowed_user_id = int(values["TELEGRAM_ALLOWED_USER_ID"])
        except ValueError as error:
            raise ValueError("TELEGRAM_CHAT_ID and TELEGRAM_ALLOWED_USER_ID must be numeric IDs") from error

        state_directory = Path(
            os.environ.get("STATE_DIRECTORY")
            or os.environ.get("TELEGRAM_BOT_STATE_DIR")
            or "/var/lib/finance-manager-telegram-bot"
        )
        return cls(
            token=values["TELEGRAM_BOT_TOKEN"],
            chat_id=chat_id,
            allowed_user_id=allowed_user_id,
            project_dir=project_dir,
            update_script=project_dir / "scripts" / "update-prod.sh",
            offset_path=state_directory / "update-offset",
        )


class TelegramApi:
    def __init__(self, token: str) -> None:
        self._base_url = f"https://api.telegram.org/bot{token}/"

    def call(self, method: str, payload: dict[str, Any]) -> Any:
        request = urllib.request.Request(
            self._base_url + method,
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        try:
            with urllib.request.urlopen(request, timeout=60) as response:
                result = json.loads(response.read())
        except (urllib.error.URLError, TimeoutError, ValueError, OSError):
            raise TelegramApiError(f"Telegram {method} request failed") from None
        if not isinstance(result, dict) or not result.get("ok"):
            raise TelegramApiError(f"Telegram {method} request was rejected")
        return result.get("result")

    def get_me(self) -> dict[str, Any]:
        result = self.call("getMe", {})
        if not isinstance(result, dict):
            raise TelegramApiError("Telegram getMe returned an invalid response")
        return result

    def get_webhook_info(self) -> dict[str, Any]:
        result = self.call("getWebhookInfo", {})
        if not isinstance(result, dict):
            raise TelegramApiError("Telegram getWebhookInfo returned an invalid response")
        return result

    def get_updates(self, offset: int, timeout: int) -> list[dict[str, Any]]:
        result = self.call(
            "getUpdates",
            {"offset": offset, "timeout": timeout, "allowed_updates": ["message"]},
        )
        if not isinstance(result, list):
            raise TelegramApiError("Telegram getUpdates returned an invalid response")
        return [update for update in result if isinstance(update, dict)]

    def send_message(self, chat_id: int, text: str) -> None:
        self.call("sendMessage", {"chat_id": chat_id, "text": text[:3900]})


class TelegramUpdateBot:
    def __init__(
        self,
        config: BotConfig,
        api: Any,
        command_prefix: list[str] | None = None,
    ) -> None:
        self.config = config
        self.api = api
        self.command_prefix = command_prefix or ["/bin/bash", str(config.update_script)]
        self.bot_username: str | None = None
        self._state_lock = threading.Lock()
        self._busy = False

    def notify(self, text: str) -> None:
        try:
            self.api.send_message(self.config.chat_id, text[:3900])
        except Exception:
            LOG.exception("Could not send a Telegram status message")

    @staticmethod
    def _is_integer(value: Any) -> bool:
        return isinstance(value, int) and not isinstance(value, bool)

    def _is_authorized(self, message: Any) -> bool:
        if not isinstance(message, dict):
            return False
        chat = message.get("chat")
        sender = message.get("from")
        return (
            isinstance(chat, dict)
            and isinstance(sender, dict)
            and chat.get("type") == "private"
            and self._is_integer(chat.get("id"))
            and self._is_integer(sender.get("id"))
            and chat["id"] == self.config.chat_id
            and sender["id"] == self.config.allowed_user_id
            and sender.get("is_bot") is not True
        )

    def _command_parts(self, text: str) -> list[str] | None:
        parts = text.strip().split()
        if not parts or not parts[0].startswith("/"):
            return None
        command = parts[0][1:]
        if "@" in command:
            command_name, target_username = command.rsplit("@", 1)
            if not self.bot_username or target_username.casefold() != self.bot_username.casefold():
                return None
            parts[0] = "/" + command_name
        return parts

    def handle_message(self, message: Any) -> None:
        if not self._is_authorized(message):
            return
        text = message.get("text")
        if not isinstance(text, str):
            return
        parts = self._command_parts(text)
        if parts is None:
            return
        command = parts[0].lower()
        if command == "/help":
            self.notify(HELP_TEXT if len(parts) == 1 else f"Usage: /help\n\n{HELP_TEXT}")
            return
        if command != "/update":
            self.notify(HELP_TEXT)
            return
        if len(parts) != 2 or (parts[1] not in MODES and parts[1] not in {"pull", "restart"}):
            self.notify(f"Usage: /update <pull|restart|frontend|backend|both|both-migrate>\n\n{HELP_TEXT}")
            return
        self.start_update(parts[1])

    def _step_label(self, mode: str, step: str) -> str:
        if mode == "pull":
            return "Pulling latest code from origin/master"
        if mode == "restart":
            return "Restarting all production Compose services"
        if step == "build":
            return f"Building {MODE_SERVICES[mode]} image(s)"
        return STEP_LABELS.get(step, "Checking deployment prerequisites")

    def start_update(self, mode: str) -> None:
        with self._state_lock:
            already_running = self._busy
            if not already_running:
                self._busy = True
        if already_running:
            self.notify("A production update is already running. Please wait for it to finish.")
            return

        if mode == "pull":
            self.notify("⏳ Git pull accepted. Checking the master branch and pulling origin/master.")
        elif mode == "restart":
            self.notify("⏳ Restart accepted. Restarting production Compose services without pulling or building.")
        else:
            self.notify(f"⏳ Update {mode} accepted. Starting deployment checks.")
        worker = threading.Thread(target=self._run_update, args=(mode,), daemon=True)
        worker.start()

    @staticmethod
    def _redact(line: str, token: str) -> str:
        redacted = line.replace(token, "[redacted]") if token else line
        return re.sub(
            r"(?i)\b(password|secret|token|api[_-]?key)\b(\s*[=:]\s*)\S+",
            r"\1\2[redacted]",
            redacted,
        )

    def _run_update(self, mode: str) -> None:
        current_step = "preflight"
        output_tail: deque[str] = deque(maxlen=16)
        exit_code: int | None = None
        try:
            child_environment = os.environ.copy()
            child_environment["GIT_TERMINAL_PROMPT"] = "0"
            process = subprocess.Popen(
                [*self.command_prefix, mode],
                cwd=self.config.project_dir,
                env=child_environment,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                bufsize=1,
            )
            assert process.stdout is not None
            with process.stdout:
                for raw_line in process.stdout:
                    line = self._redact(raw_line.rstrip(), self.config.token)
                    if not line:
                        continue
                    LOG.info("update[%s] %s", mode, line)
                    if line.startswith("BOT_STEP:"):
                        candidate = line.partition(":")[2]
                        if candidate in {"pull", "build", "migrate", "start", "restart"}:
                            current_step = candidate
                            operation = "Git pull" if mode == "pull" else f"Update {mode}"
                            if mode == "restart":
                                operation = "Container restart"
                            self.notify(f"🔄 {operation}: {self._step_label(mode, current_step)}.")
                    else:
                        output_tail.append(line)
            exit_code = process.wait()
            if exit_code == 0:
                if mode == "pull":
                    self.notify("✅ Git pull finished successfully. No containers were built or restarted.")
                elif mode == "restart":
                    self.notify("✅ Production Compose services restarted successfully.")
                else:
                    self.notify(f"✅ Update {mode} finished successfully.")
            else:
                tail = "\n".join(output_tail)
                if len(tail) > 1800:
                    tail = "…\n" + tail[-1800:]
                details = f"\n\nLast output:\n{tail}" if tail else ""
                operation = "Git pull" if mode == "pull" else f"Update {mode}"
                if mode == "restart":
                    operation = "Container restart"
                self.notify(
                    f"❌ {operation} failed during {self._step_label(mode, current_step)} "
                    f"(exit code {exit_code}).{details}"
                )
        except Exception as error:
            LOG.exception("Update worker failed for mode %s", mode)
            detail = self._redact(str(error), self.config.token)[:800]
            operation = "Git pull" if mode == "pull" else f"Update {mode}"
            if mode == "restart":
                operation = "Container restart"
            self.notify(f"❌ {operation} failed during {self._step_label(mode, current_step)}.\n{detail}")
        finally:
            with self._state_lock:
                self._busy = False

    def _load_offset(self) -> int | None:
        try:
            value = self.config.offset_path.read_text(encoding="ascii").strip()
            offset = int(value)
        except FileNotFoundError:
            return None
        except (OSError, ValueError) as error:
            raise RuntimeError("The Telegram update offset state file is invalid or unreadable") from error
        if offset < 0:
            raise RuntimeError("The Telegram update offset state file contains a negative offset")
        return offset

    def _save_offset(self, offset: int) -> None:
        path = self.config.offset_path
        path.parent.mkdir(parents=True, exist_ok=True)
        temporary_name: str | None = None
        try:
            with tempfile.NamedTemporaryFile(
                mode="w", encoding="ascii", dir=path.parent, prefix=".update-offset-", delete=False
            ) as temporary:
                temporary.write(f"{offset}\n")
                temporary.flush()
                os.fsync(temporary.fileno())
                temporary_name = temporary.name
            os.chmod(temporary_name, 0o600)
            os.replace(temporary_name, path)
        finally:
            if temporary_name and os.path.exists(temporary_name):
                os.unlink(temporary_name)

    def initialize_offset(self) -> int:
        saved = self._load_offset()
        if saved is not None:
            return saved

        # On first install, discard queued pre-install updates so old commands
        # cannot unexpectedly trigger a production deployment.
        pending = self.api.get_updates(offset=-1, timeout=0)
        latest_update = max(
            (update["update_id"] for update in pending if self._is_integer(update.get("update_id"))),
            default=-1,
        )
        offset = latest_update + 1
        self._save_offset(offset)
        return offset

    def verify_polling_available(self) -> None:
        webhook = self.api.get_webhook_info()
        if webhook.get("url"):
            raise RuntimeError(
                "This Telegram bot already has a webhook configured. Remove or migrate that webhook "
                "before starting the long-polling update bot."
            )

    def run_forever(self) -> None:
        while True:
            try:
                me = self.api.get_me()
                username = me.get("username")
                self.bot_username = username if isinstance(username, str) else None
                self.verify_polling_available()
                offset = self.initialize_offset()
                break
            except TelegramApiError:
                LOG.exception("Telegram startup check failed; retrying shortly")
                time.sleep(5)
        LOG.info("Telegram update bot is polling for authorized commands")

        while True:
            try:
                updates = self.api.get_updates(offset=offset, timeout=50)
                for update in updates:
                    update_id = update.get("update_id")
                    if not self._is_integer(update_id):
                        continue
                    offset = update_id + 1
                    self._save_offset(offset)
                    self.handle_message(update.get("message"))
            except TelegramApiError:
                LOG.exception("Telegram polling failed; retrying shortly")
                time.sleep(5)


def main() -> int:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s %(message)s",
        stream=sys.stdout,
    )
    try:
        config = BotConfig.load()
        bot = TelegramUpdateBot(config, TelegramApi(config.token))
        if sys.argv[1:] == ["--check-webhook"]:
            bot.verify_polling_available()
            print("No Telegram webhook is configured; long polling is available.")
            return 0
        if sys.argv[1:]:
            print("Usage: python3 scripts/telegram-update-bot.py [--check-webhook]", file=sys.stderr)
            return 2
        bot.run_forever()
    except KeyboardInterrupt:
        return 0
    except Exception as error:
        LOG.error("Telegram update bot stopped: %s", error)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
