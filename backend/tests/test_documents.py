import io

from tests.conftest import create_project


def test_content_disposition_handles_accented_and_quoted_filenames():
    from urllib.parse import unquote

    from app.api.documents import _content_disposition

    original = 'Szerződés "final".pdf'
    header = _content_disposition(original)

    # ascii fallback must not contain a stray embedded quote that would break the param
    ascii_part = header.split('filename="', 1)[1].split('"; filename*=')[0]
    assert '"' not in ascii_part

    # the UTF-8 extended form must round-trip the real (accented) filename
    encoded = header.split("filename*=UTF-8''", 1)[1]
    assert unquote(encoded) == original


def test_upload_list_download_delete_document(client, admin_headers):
    project = create_project(client, admin_headers)

    upload = client.post(
        f"/api/projects/{project['id']}/documents",
        files={"file": ("contract.pdf", io.BytesIO(b"%PDF-1.4 fake"), "application/pdf")},
        headers=admin_headers,
    )
    assert upload.status_code == 200
    doc = upload.json()
    assert doc["original_filename"] == "contract.pdf"
    assert doc["version"] == 1

    listing = client.get(
        f"/api/projects/{project['id']}/documents", headers=admin_headers
    ).json()
    assert len(listing) == 1

    download = client.get(
        f"/api/projects/{project['id']}/documents/{doc['id']}/download",
        headers=admin_headers,
    )
    assert download.status_code == 200
    assert download.json()["url"].startswith("http://fake-s3.local/")

    delete = client.delete(
        f"/api/projects/{project['id']}/documents/{doc['id']}", headers=admin_headers
    )
    assert delete.status_code == 200

    listing_after = client.get(
        f"/api/projects/{project['id']}/documents", headers=admin_headers
    ).json()
    assert listing_after == []


def test_reuploading_same_filename_bumps_version(client, admin_headers):
    project = create_project(client, admin_headers)
    for _ in range(2):
        resp = client.post(
            f"/api/projects/{project['id']}/documents",
            files={"file": ("plan.dwg", io.BytesIO(b"data"), "application/octet-stream")},
            headers=admin_headers,
        )
        assert resp.status_code == 200
    listing = client.get(
        f"/api/projects/{project['id']}/documents", headers=admin_headers
    ).json()
    versions = sorted(d["version"] for d in listing)
    assert versions == [1, 2]


def test_rejects_disallowed_file_extension(client, admin_headers):
    project = create_project(client, admin_headers)
    resp = client.post(
        f"/api/projects/{project['id']}/documents",
        files={"file": ("virus.exe", io.BytesIO(b"data"), "application/octet-stream")},
        headers=admin_headers,
    )
    assert resp.status_code == 400
