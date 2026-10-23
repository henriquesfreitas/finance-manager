from __future__ import annotations

import threading
import time
import unittest
import sys
import uuid
import importlib.util
from pathlib import Path
from typing import Any

BOT_PATH = Path(__file__).with_name("telegram-update-bot.py")
BOT_SPEC = importlib.util.spec_from_file_location("telegram_update_bot", BOT_PATH)
assert BOT_SPEC is not None and BOT_SPEC.loader is not None
BOT_MODULE = importlib.util.module_from_spec(BOT_SPEC)
sys.modules[BOT_SPEC.name] = BOT_MODULE
BOT_SPEC.loader.exec_module(BOT_MODULE)
BotConfig = BOT_MODULE.BotConfig
TelegramUpdateBot = BOT_MODULE.TelegramUpdateBot


FAKE_UPDATE_PROCESS = """
import sys
import time

failure, mode = sys.argv[1], sys.argv[2]
if mode == "test":
    steps = ["test_build", "test_run"]
elif mode == "pull":
    steps = ["pull"]
elif mode == "restart":
    steps = ["restart"]
else:
    steps = ["pull", "build"] + (["migrate"] if mode == "both-migrate" else []) + ["start"]
for step in steps:
    print(f"BOT_STEP:{step}", flush=True)
    if step == "pull":
        time.sleep(0.15)
    if failure == step:
        print(f"synthetic failure during {step}", flush=True)
        raise SystemExit(7)
print("synthetic update complete", flush=True)
"""


class FakeTelegramApi:
    def __init__(self) -> None:
        self.messages: list[str] = []
        self.message_lock = threading.Lock()
        self.message_event = threading.Event()
        self.updates: list[dict[str, Any]] = []
        self.poll_offsets: list[int] = []
        self.get_updates_calls = 0
        self.webhook_url = ""
        self.stop_polling = False

    def send_message(self, chat_id: int, text: str) -> None:
        with self.message_lock:
            self.messages.append(text)
            self.message_event.set()

    def get_me(self) -> dict[str, Any]:
        return {"username": "finance_manager_bot"}

    def get_webhook_info(self) -> dict[str, Any]:
        return {"url": self.webhook_url}

    def get_updates(self, offset: int, timeout: int) -> list[dict[str, Any]]:
        self.get_updates_calls += 1
        self.poll_offsets.append(offset)
        if self.stop_polling:
            raise KeyboardInterrupt
        updates, self.updates = self.updates, []
        return updates


class TelegramUpdateBotTests(unittest.TestCase):
    def setUp(self) -> None:
        self.root = Path(__file__).resolve().parent
        self.offset_path = self.root / f".telegram-test-offset-{uuid.uuid4().hex}"
        self.api = FakeTelegramApi()
        self.config = BotConfig(
            token="test-token-secret",
            chat_id=123456,
            allowed_user_id=123456,
            project_dir=self.root,
            update_script=self.root / "scripts" / "update-prod.sh",
            offset_path=self.offset_path,
        )
        self.bot = self.make_bot()

    def tearDown(self) -> None:
        self.offset_path.unlink(missing_ok=True)

    def make_bot(self, failure: str = "none") -> TelegramUpdateBot:
        return TelegramUpdateBot(
            self.config,
            self.api,
            command_prefix=[
                sys.executable,
                "-u",
                "-c",
                FAKE_UPDATE_PROCESS,
                failure,
            ],
        )

    def message(self, text: str, *, sender: int = 123456, chat: int = 123456, chat_type: str = "private") -> dict[str, Any]:
        return {
            "text": text,
            "chat": {"id": chat, "type": chat_type},
            "from": {"id": sender, "is_bot": False},
        }

    def wait_for_idle(self, timeout: float = 5) -> None:
        deadline = time.monotonic() + timeout
        while time.monotonic() < deadline:
            with self.bot._state_lock:
                if not self.bot._busy:
                    return
            time.sleep(0.01)
        self.fail("update worker did not finish")

    def message_snapshot(self) -> list[str]:
        with self.api.message_lock:
            return list(self.api.messages)

    def send_authorized_update(self, mode: str) -> None:
        self.bot.handle_message(self.message(f"/update {mode}"))
        self.wait_for_idle()

    def test_unauthorized_sender_chat_and_group_are_ignored(self) -> None:
        self.bot.handle_message(self.message("/update both", sender=999))
        self.bot.handle_message(self.message("/update both", chat=999))
        self.bot.handle_message(self.message("/update both", chat_type="group"))
        self.assertEqual(self.message_snapshot(), [])

    def test_help_and_invalid_modes_are_reported_without_running_script(self) -> None:
        self.bot.handle_message(self.message("/help"))
        self.bot.handle_message(self.message("/update"))
        self.bot.handle_message(self.message("/update arbitrary-shell-text"))
        messages = self.message_snapshot()
        self.assertEqual(len(messages), 3)
        self.assertTrue(all("/update pull" in message for message in messages))

    def test_pull_mode_reports_pull_only_and_success(self) -> None:
        self.bot.handle_message(self.message("/update pull"))
        self.wait_for_idle()
        messages = self.message_snapshot()
        self.assertTrue(any("Git pull accepted" in message for message in messages))
        self.assertTrue(any("Git pull: Pulling latest code" in message for message in messages))
        self.assertTrue(any("Git pull finished successfully" in message for message in messages))
        self.assertFalse(any("Building" in message or "Starting" in message for message in messages))

    def test_pull_mode_failure_reports_pull_step(self) -> None:
        self.bot = self.make_bot(failure="pull")
        self.bot.handle_message(self.message("/update pull"))
        self.wait_for_idle()
        failure = next(message for message in self.message_snapshot() if "failed during" in message)
        self.assertIn("Git pull failed during Pulling latest code", failure)
        self.assertIn("synthetic failure during pull", failure)

    def test_test_mode_reports_build_run_and_success(self) -> None:
        self.bot.handle_message(self.message("/update test"))
        self.wait_for_idle()
        messages = self.message_snapshot()
        self.assertTrue(any("Production test run accepted" in message for message in messages))
        self.assertTrue(any("Building the isolated production test image" in message for message in messages))
        self.assertTrue(any("Running the production test suite" in message for message in messages))
        self.assertTrue(any("Production tests passed" in message for message in messages))

    def test_test_mode_failures_report_the_failed_phase(self) -> None:
        for step, expected_label in (
            ("test_build", "Building the isolated production test image"),
            ("test_run", "Running the production test suite"),
        ):
            with self.subTest(step=step):
                self.api.messages.clear()
                self.bot = self.make_bot(failure=step)
                self.bot.handle_message(self.message("/update test"))
                self.wait_for_idle()
                failure = next(message for message in self.message_snapshot() if "failed during" in message)
                self.assertIn(f"Production tests failed during {expected_label}", failure)
                self.assertIn(f"synthetic failure during {step}", failure)

    def test_commands_for_another_bot_are_ignored(self) -> None:
        self.bot.bot_username = "finance_manager_bot"
        self.bot.handle_message(self.message("/update@another_bot both"))
        self.assertEqual(self.message_snapshot(), [])

    def test_command_addressed_to_this_bot_is_accepted(self) -> None:
        self.bot.bot_username = "finance_manager_bot"
        self.bot.handle_message(self.message("/update@finance_manager_bot frontend"))
        self.wait_for_idle()
        self.assertTrue(any("Update frontend finished successfully" in message for message in self.message_snapshot()))

    def test_all_modes_report_each_step_and_success(self) -> None:
        expected_steps = {
            "frontend": ["pull", "build", "start"],
            "backend": ["pull", "build", "start"],
            "both": ["pull", "build", "start"],
            "both-migrate": ["pull", "build", "migrate", "start"],
        }
        for mode, steps in expected_steps.items():
            with self.subTest(mode=mode):
                self.api.messages.clear()
                self.bot = self.make_bot()
                self.send_authorized_update(mode)
                messages = self.message_snapshot()
                self.assertTrue(any(f"Update {mode} accepted" in message for message in messages))
                for step in steps:
                    expected_label = "migration" if step == "migrate" else step
                    self.assertTrue(
                        any(f"Update {mode}:" in message and expected_label in message.lower() for message in messages),
                        f"missing {step} progress update for {mode}: {messages}",
                    )
                self.assertTrue(any(f"Update {mode} finished successfully" in message for message in messages))

    def test_failure_at_each_deployment_step_names_step_and_output_tail(self) -> None:
        for step in ("pull", "build", "migrate", "start"):
            with self.subTest(step=step):
                self.api.messages.clear()
                self.bot = self.make_bot(failure=step)
                self.send_authorized_update("both-migrate")
                failure = next(message for message in self.message_snapshot() if "failed during" in message)
                expected_label = "migration" if step == "migrate" else step
                self.assertIn(expected_label, failure.lower())
                self.assertIn(f"synthetic failure during {step}", failure)

    def test_running_update_rejects_second_command(self) -> None:
        self.bot.handle_message(self.message("/update frontend"))
        self.assertTrue(self.api.message_event.wait(2))
        self.bot.handle_message(self.message("/update backend"))
        self.wait_for_idle()
        self.assertTrue(any("already running" in message for message in self.message_snapshot()))
        self.assertFalse(any("Update backend accepted" in message for message in self.message_snapshot()))

    def test_initial_offset_discards_pending_updates_and_is_saved(self) -> None:
        self.api.updates = [{"update_id": 42}, {"update_id": 45}]
        offset = self.bot.initialize_offset()
        self.assertEqual(offset, 46)
        self.assertEqual(self.offset_path.read_text(encoding="ascii").strip(), "46")
        self.assertEqual(self.api.poll_offsets, [-1])

        restarted = self.make_bot()
        self.assertEqual(restarted.initialize_offset(), 46)
        self.assertEqual(self.api.get_updates_calls, 1)

    def test_polling_reuses_saved_offset_after_restart(self) -> None:
        self.bot._save_offset(77)
        self.api.stop_polling = True
        self.bot.api.get_me()
        with self.assertRaises(KeyboardInterrupt):
            self.bot.run_forever()
        self.assertEqual(self.api.poll_offsets, [77])

    def test_existing_webhook_blocks_polling(self) -> None:
        self.api.webhook_url = "https://example.invalid/telegram-hook"
        with self.assertRaisesRegex(RuntimeError, "webhook configured"):
            self.bot.verify_polling_available()


if __name__ == "__main__":
    unittest.main()
