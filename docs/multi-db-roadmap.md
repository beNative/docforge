# Multi-Database Support Roadmap

## Phase 1 – Data Layer Foundations
1. **Connection Management Abstractions**
   - Introduce a registry that can hold multiple `DatabaseConnection` instances.
   - Normalize connection lifecycle hooks (open, close, refresh) to work on a per-connection basis.
   - Add messaging/events for when connections are added or removed.
2. **Shared Metadata Contracts**
   - Update type definitions so UI consumers can rely on a consistent schema for multiple databases (e.g., add database id/name fields).
   - Ensure document nodes carry their originating database id.
3. **API Enhancements**
   - Extend services to accept a connection identifier and return namespaced results.
   - Provide bulk fetch helpers for initial tree population per database.

## Phase 2 – UI Scaffolding for Multiple Databases
1. **Left Sidebar Tab Strip**
   - Design tab data model and props to render one tab per connected database.
   - Implement tab switching logic that informs downstream components which database is active.
   - Add visual affordances (active, hover, close).
2. **Database Connection Dialog Improvements**
   - Allow selecting/opening multiple files in sequence or re-opening the dialog to attach more databases.
   - Display status indicators per connection.
3. **State Synchronization**
   - Ensure global context/provider exposes the list of connections and active selection.
   - Update existing tree/editor components to subscribe to the active database context.

## Phase 3 – Split Main View Layout
1. **Layout System**
   - Introduce a split-pane layout (drag-resizable if feasible) that can render two independent tree+editor columns.
   - Provide responsive defaults for single vs. dual-pane modes.
2. **Component Refactor**
   - Extract a reusable `DatabaseWorkspace` composed of tree view + editor that accepts a database id.
   - Mount one or two `DatabaseWorkspace` instances based on layout mode selection.
3. **User Controls**
   - Add UI affordance (toolbar or shortcut) to toggle between single and dual view.
   - Persist user preference if possible.

## Phase 4 – Cross-Database Document Transfer
1. **Drag-and-Drop/Context Actions**
   - Enable dragging document nodes between workspaces or provide contextual actions (copy/move).
   - Validate transfers (e.g., prevent duplicates or incompatible types).
2. **Transfer Pipeline**
   - Implement service-level operations to copy/move documents across databases, including metadata updates.
   - Handle conflict resolution and error messaging.
3. **Sync & Refresh**
   - Refresh both source and destination trees after transfer.
   - Add activity/toast notifications for success/failure.

## Phase 5 – Polish & Testing
1. **Comprehensive Testing**
   - Unit tests for connection registry and transfer services.
   - Integration/e2e tests covering tab switching, split view, and cross-database transfers.
2. **Performance & UX**
   - Optimize initial load and ensure lazy loading per database to avoid UI lag.
   - Refine keyboard accessibility and screen reader announcements for new UI elements.
3. **Documentation**
   - Update README/technical docs with instructions for managing multiple databases and using split view.

This roadmap is structured so each phase builds on the previous one, allowing incremental delivery and testing of multi-database functionality.
