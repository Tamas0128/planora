import io

from tests.conftest import create_project


def test_upload_list_download_delete_photo(client, admin_headers):
    project = create_project(client, admin_headers)

    upload = client.post(
        f"/api/projects/{project['id']}/photos",
        files={"file": ("site.jpg", io.BytesIO(b"fake-jpeg"), "image/jpeg")},
        data={"taken_at": "2026-06-01", "comment": "Alapozás kész"},
        headers=admin_headers,
    )
    assert upload.status_code == 200, upload.text
    photo = upload.json()
    assert photo["filename"] == "site.jpg"
    assert photo["comment"] == "Alapozás kész"
    assert photo["taken_at"] == "2026-06-01"

    listing = client.get(
        f"/api/projects/{project['id']}/photos", headers=admin_headers
    ).json()
    assert len(listing) == 1

    download = client.get(
        f"/api/projects/{project['id']}/photos/{photo['id']}/download",
        headers=admin_headers,
    )
    assert download.status_code == 200
    assert download.json()["url"].startswith("http://fake-s3.local/")

    delete = client.delete(
        f"/api/projects/{project['id']}/photos/{photo['id']}", headers=admin_headers
    )
    assert delete.status_code == 200

    listing_after = client.get(
        f"/api/projects/{project['id']}/photos", headers=admin_headers
    ).json()
    assert listing_after == []


def test_rejects_disallowed_photo_extension(client, admin_headers):
    project = create_project(client, admin_headers)
    resp = client.post(
        f"/api/projects/{project['id']}/photos",
        files={"file": ("plan.pdf", io.BytesIO(b"data"), "application/pdf")},
        data={"taken_at": "2026-06-01"},
        headers=admin_headers,
    )
    assert resp.status_code == 400
