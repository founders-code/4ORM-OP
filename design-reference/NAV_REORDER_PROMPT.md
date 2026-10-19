# 4ormop.com - drag to reorder the left menu. Paste into Cursor.

Chad wants to rearrange the left sidebar menu items himself (drag up/down) to find the best top-to-bottom flow. Keep the sidebar's current look exactly - this adds behaviour only.

1. ARRANGE MODE: add a small "Arrange" control at the bottom of the sidebar (subtle text button, same style as the nav labels). Clicking it turns on arrange mode: each menu item shows a 6-dot grip on its left and can be dragged. The button becomes "Done" plus a small "Reset to default" link. Outside arrange mode the menu works exactly as now (no accidental drags).
2. DRAG: drag any item up or down within its section, or across sections (between "Workspace" and "Signals & data"). Show a thin blue insertion line where it will drop; the dragged item follows the cursor slightly lifted. Use @dnd-kit (or the existing drag library if one is installed); works with mouse and trackpad. Keyboard: focus an item and press Alt+Up / Alt+Down to move it.
3. SECTIONS: the two section headers can also be dragged to swap section order. Item badges (Pipeline 246, Integrations 0) and the active highlight move with their item.
4. SAVE: order saves instantly on drop, per user. Persist in Neon: nav_prefs (owner_id text primary key, order jsonb, updated_at) CREATE TABLE IF NOT EXISTS; GET/PUT /api/nav-prefs, owner-scoped, fail soft. Also mirror to localStorage so the menu renders in the saved order with no flash on load. New pages added later that are not in the saved order appear at the end of their default section. "Reset to default" restores the shipped order.
5. Do NOT change routes, page names, icons, colours, sidebar width, collapse behaviour, or the Clerk sign-in. DATA SAFETY: additive only.
6. SELF-CHECK: drag Playbook to the top of Workspace, move News into Workspace, reload - order sticks; sign out/in - order sticks; Reset - back to default; outside arrange mode clicking items navigates normally. Report the result.

Commit to `main`, push, confirm the Vercel production deployment.
