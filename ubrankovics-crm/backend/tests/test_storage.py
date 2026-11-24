import pytest

from app.services import storage


@pytest.fixture(autouse=True)
def _local(tmp_path, monkeypatch):
    monkeypatch.setattr("app.config.settings.upload_dir", str(tmp_path))
    monkeypatch.setattr("app.config.settings.storage_backend", "local")


def test_save_read_delete_roundtrip():
    storage.save("a.bin", b"abc")
    assert storage.exists("a.bin")
    assert storage.read("a.bin") == b"abc"
    storage.delete("a.bin")
    assert not storage.exists("a.bin")


def test_read_missing_raises_filenotfound():
    with pytest.raises(FileNotFoundError):
        storage.read("nincs.bin")


def test_delete_missing_is_noop():
    storage.delete("nincs.bin")
