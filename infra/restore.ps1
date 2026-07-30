<#
.SYNOPSIS
  Restores a PLANora Docker stack's Postgres database and/or MinIO document
  storage from the backups made by the postgres-backup / minio-backup
  services already defined in docker-compose.yml.

.DESCRIPTION
  Both backup services keep their data in Docker volumes, independent of
  the app containers, so a crashed/corrupted deployment can be rebuilt from
  scratch and then restored via this script. Postgres backups are plain
  gzipped SQL dumps (postgres-backup-local); MinIO backups are daily
  mc-mirror snapshots (infra/minio-backup).

  This is DESTRUCTIVE — it overwrites the live database and/or bucket
  contents — so each target asks for confirmation unless -Force is passed.

.PARAMETER Project
  Docker Compose project name whose stack to restore into.
  Defaults to "planora-pilot".

.PARAMETER Target
  Which part to restore: "postgres", "minio", or "all" (default).

.PARAMETER PostgresBackupFile
  Exact filename inside the postgres-backup container's /backups/last/
  directory to restore from (e.g. "planora_pilot-20260730-013000.sql.gz").
  Defaults to that folder's "-latest.sql.gz" symlink target.

.PARAMETER MinioSnapshotDate
  Exact dated folder inside the minio-backup container's /backups/
  directory to restore from (e.g. "2026-07-30"). Defaults to the most
  recent one.

.PARAMETER Force
  Skip the confirmation prompt(s).

.EXAMPLE
  ./infra/restore.ps1
  Restores both Postgres and MinIO for planora-pilot from the latest backups.

.EXAMPLE
  ./infra/restore.ps1 -Project planora -Target postgres -PostgresBackupFile planora-20260728.sql.gz
  Restores only Postgres for the main "planora" stack from a specific dump.
#>
param(
    [string]$Project = "planora-pilot",
    [ValidateSet("postgres", "minio", "all")]
    [string]$Target = "all",
    [string]$PostgresBackupFile = "",
    [string]$MinioSnapshotDate = "",
    [switch]$Force
)

$ErrorActionPreference = "Stop"

function Restore-Postgres {
    $pg = "$Project-postgres-1"
    $bak = "$Project-postgres-backup-1"

    foreach ($c in @($pg, $bak)) {
        if (-not (docker ps -q -f "name=^$c`$")) {
            throw "Container '$c' is not running. Start the stack first."
        }
    }

    $dbUser = (docker exec $pg printenv POSTGRES_USER).Trim()
    $dbName = (docker exec $pg printenv POSTGRES_DB).Trim()

    $file = $PostgresBackupFile
    if (-not $file) {
        $file = (docker exec $bak sh -c "basename `"`$(readlink -f /backups/last/${dbName}-latest.sql.gz)`"").Trim()
    }
    if (-not $file) {
        throw "No Postgres backup found in /backups/last/ for database '$dbName' in container '$bak'."
    }

    Write-Host "Postgres restore: '$dbName' in $pg <- /backups/last/$file (from $bak)" -ForegroundColor Yellow
    if (-not $Force) {
        $confirm = Read-Host "This OVERWRITES the current '$dbName' database. Type 'yes' to continue"
        if ($confirm -ne "yes") { Write-Host "Postgres restore cancelled."; return }
    }

    docker exec $bak sh -c "gunzip -c /backups/last/$file" | docker exec -i $pg psql -U $dbUser -d $dbName
    Write-Host "Postgres restore complete." -ForegroundColor Green
}

function Restore-Minio {
    $minio = "$Project-minio-1"
    $bak = "$Project-minio-backup-1"

    foreach ($c in @($minio, $bak)) {
        if (-not (docker ps -q -f "name=^$c`$")) {
            throw "Container '$c' is not running. Start the stack first."
        }
    }

    $date = $MinioSnapshotDate
    if (-not $date) {
        $date = (docker exec $bak sh -c "ls -1 /backups | sort | tail -1").Trim()
    }
    if (-not $date) {
        throw "No MinIO snapshot folders found in /backups/ in container '$bak'."
    }

    $bucket = (docker exec $bak printenv MC_BUCKET).Trim()
    $hostUrl = (docker exec $bak printenv MC_HOST_URL).Trim()
    $accessKey = (docker exec $bak printenv MC_ACCESS_KEY).Trim()
    $secretKey = (docker exec $bak printenv MC_SECRET_KEY).Trim()

    Write-Host "MinIO restore: bucket '$bucket' <- /backups/$date (from $bak)" -ForegroundColor Yellow
    if (-not $Force) {
        $confirm = Read-Host "This OVERWRITES current files in bucket '$bucket'. Type 'yes' to continue"
        if ($confirm -ne "yes") { Write-Host "MinIO restore cancelled."; return }
    }

    docker exec $bak sh -c "mc alias set src '$hostUrl' '$accessKey' '$secretKey' >/dev/null && mc mirror --overwrite '/backups/$date' 'src/$bucket'"
    Write-Host "MinIO restore complete." -ForegroundColor Green
}

if ($Target -eq "postgres" -or $Target -eq "all") { Restore-Postgres }
if ($Target -eq "minio" -or $Target -eq "all") { Restore-Minio }
