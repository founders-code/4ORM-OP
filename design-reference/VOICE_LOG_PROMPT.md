# 4ormop.com - Playbook VOICE LOG (record, transcribe, file it). Paste into Cursor.

PRE-FLIGHT: confirm design-reference/playbook.html is the full file (~45KB) and contains the "VOICE LOG - SAY WHAT YOU DID" section (classes .vlog, .recbtn, .vtx, .heard, .vhist). Open it and match that section exactly, inside the same Shadow DOM root as the rest of the Playbook. Do not touch Clerk sign-in. DATA SAFETY: additive only.

WHAT IT DOES: Chad taps record, says what he got done, and it is transcribed, understood and filed.
1. RECORD: the round red button records from the mic (MediaRecorder, webm/opus). Timer counts up, the waveform moves with the real mic level (AnalyserNode). Tap again to stop. Ask for mic permission on first tap; if denied, show an inline note "Allow the microphone in your browser to record". Max 10 minutes. Also allow typing straight into the transcript box.
2. TRANSCRIBE: while recording, show live words using the browser SpeechRecognition API where available (Chrome/Edge/Brave). On stop, send the audio to POST /api/voice/transcribe, which calls OpenAI transcription (gpt-4o-transcribe, or whisper-1) with env OPENAI_API_KEY, and replace the live text with the accurate transcript. The transcript stays editable before saving.
3. UNDERSTAND: POST /api/voice/parse sends the transcript plus today's Playbook rhythms to the LLM and returns structured items:
   - play updates: which rhythm it matches and the value (e.g. "Post today's clip" -> done; "Reach out 5" -> 3/5; "Engage 10 min" -> 4/5)
   - new tasks: text + due (e.g. "Send Kevin the GTM deck" -> Execution, Tue), linked to a Contact if the name matches
   - notes: text + where it belongs (Newsletter, a Space, Notes)
   Render them in the "4orm Intelligence heard" card exactly as the mockup (checkbox, row-colour swatch, label, tag). Each item can be unticked.
4. SAVE TO: chips "Today's log" (default), "Completed", "A Space...", "Notes", "Drive doc". "Save to today" then:
   - writes the ticked play updates to playbook_log (pads light off / show progress immediately)
   - creates the ticked tasks in War Room Execution (Today / This week by due date)
   - files the notes to the chosen place (a Space's Notes, the Notes page, or the newsletter material bin)
   - appends the whole entry (time, transcript, items) to TODAY'S LOG - a running daily file that the end-of-day Completed snapshot includes. "Drive doc" also appends it to a Google Doc in Drive named "Chad - Daily log - YYYY-MM" (one doc per month, newest entry on top).
5. HISTORY: under the card, today's earlier voice entries as rows (play button to replay the audio, time, first line in quotes, counts). Click a row to reopen and edit it.
6. STORAGE: voice_logs (id, owner_id, created_at, audio_url, duration_s, transcript, items jsonb, destination, saved bool) CREATE TABLE IF NOT EXISTS; audio in Vercel Blob (private, owner-scoped). Fail soft: if transcription or parsing fails, keep the audio and raw text and let Chad save it as a plain note.
7. QUICK ACCESS: a small mic button next to "Run today's plays" in the Playbook header scrolls to the Voice log and starts recording. Keyboard: press "R" on the Playbook page to start/stop.

SELF-CHECK: record "Posted today's clip, reached out to three brokers, I owe Kevin the GTM deck by Tuesday" -> transcript appears, 3 items parsed, Save -> Post clip pad turns off, Reach out shows 3/5, a "Send Kevin the GTM deck" task appears in Execution for Tuesday, the entry shows in today's history and in Today's log. Run `npm run visual-check` for playbook and paste the result. Commit to `main`, push, confirm the Vercel production deployment.
