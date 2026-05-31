# Feature Specification: Google Drive Cloud Database Sync

**Feature Branch**: `003-gdrive-sync`  
**Created**: 2026-05-31  
**Status**: Draft  
**Input**: User request: "Go ahead with the implementation of this implementation plan: 'Google Drive Cloud Database Sync'. Develop it on a dedicated feature branch"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Google Drive Account Connection (Priority: P1)

As a user sync'ing my notes across machines, I want to securely connect my DocForge application to my Google Drive account, using my own Client ID and Client Secret, so that my data is privately stored in my personal cloud space.

**Why this priority**: Account authorization is the prerequisite gateway for all subsequent synchronization actions.

**Independent Test**: Configure the Client ID and Client Secret in Settings, click "Connect", authenticate in the browser, and verify that the UI updates to show the account email as "Connected".

**Acceptance Scenarios**:

1. **Given** a user inputs a valid Client ID and Client Secret, **When** they click "Connect Google Drive", **Then** the default OS web browser opens the Google OAuth authorization prompt.
2. **Given** the user completes the OAuth authorization in their browser, **When** they return to DocForge, **Then** the local loopback HTTP server captures the authorization token, closes itself, and displays a success state showing the user's Google email.

---

### User Story 2 - Automated & Manual Database Synchronization (Priority: P1)

As a writer editing documents on multiple devices, I want my database to sync automatically when the app starts and periodically in the background, as well as manually, so that my documents are always up-to-date.

**Why this priority**: Accurate, hands-free database synchronization is the core utility of this feature.

**Independent Test**: Modify documents on Device A and click "Sync Now". Open Device B, click "Sync Now", and confirm that the modifications from Device A are visible without manual export/import.

**Acceptance Scenarios**:

1. **Given** the local database has newer edits than the cloud database, **When** a sync is triggered, **Then** a backup snapshot of the local database is uploaded to the Google Drive `appDataFolder` without interrupting current operations.
2. **Given** the cloud database has newer edits than the local database, **When** a sync is triggered, **Then** the local database connection is closed, the remote database is downloaded and applied, the connection is reopened, and the UI reloads to show updated data.

---

### User Story 3 - Interactive Conflict Resolution (Priority: P1)

As a user who edits my workspace on both my laptop and desktop while offline, I want to be notified of conflicts when I sync, showing a side-by-side comparison of local and cloud versions so that I can choose which version to keep.

**Why this priority**: Avoids silent overwrites and data loss when changes diverge.

**Independent Test**: Modify the database on both Device A and Device B while disconnected. Sync Device A first. Then sync Device B and verify the conflict modal displays comparison stats and allows selecting a winner.

**Acceptance Scenarios**:

1. **Given** both local and cloud databases have modified checksums since the last sync, **When** sync runs, **Then** the sync stops and triggers a conflict modal.
2. **Given** the conflict modal is active, **When** the user clicks "Keep Local", **Then** the local database is pushed to Google Drive, overwriting the cloud version.
3. **Given** the conflict modal is active, **When** the user clicks "Keep Cloud", **Then** the cloud version is downloaded, overwriting the local database, and the UI reloads.

---

## Edge Cases

- **Network Interruption:** If the internet connection drops during sync, the transaction must abort cleanly, leaving the local database unharmed.
- **Access Revocation:** If the refresh token is revoked on Google Cloud, the system must degrade gracefully, set status to disconnected, and prompt the user to re-authenticate.
- **Concurrent Writes during Sync:** Using SQLite's WAL mode and backing up to a temporary location using `db.backup()` prevents file locking conflicts during uploads.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST support inputting Google Cloud Client ID and Client Secret in Settings.
- **FR-002**: System MUST host a temporary loopback HTTP server to capture the Google OAuth callback.
- **FR-003**: System MUST store the encrypted/secure refresh token and metadata in the `settings` database table.
- **FR-004**: System MUST perform all file queries and uploads within the isolated `appDataFolder` Google Drive space.
- **FR-005**: System MUST compute MD5 checksums of the database files to determine if local or cloud versions have changed.
- **FR-006**: System MUST close all active better-sqlite3 handles before overwriting the local database with a cloud version.
- **FR-007**: System MUST offer manual "Sync Now" trigger and background auto-sync configurations.
- **FR-008**: System MUST display a side-by-side database comparison modal if a conflict is detected.

### Key Entities

- **Sync Credentials:** Client ID, Client Secret, Refresh Token, Access Token, and Token Expiry.
- **Database Metadata:** File size, modification time, MD5 checksum, number of document nodes, and number of templates.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Zero data corruption incidents or database locking issues across 100 simulated sync sequences.
- **SC-002**: Verification of successful sync completion in under 5 seconds on normal broadband connections.
- **SC-003**: Dynamic UI reload triggers successfully within 500ms after database swap.
