# PRD — Two-Person Photobooth

## 1. Product Overview
A beautiful browser-based photobooth designed specifically for two people. Two participants can create a session together either on the same device or remotely on separate devices.

**Vision:** A photobooth made for two — wherever they are.

**Core principle:** Two people are the minimum magic.

LDR is no longer the product positioning. Long-distance use remains a valid use case, but friends, couples, siblings, classmates, coworkers, and other pairs should feel equally welcome.

## 2. Goals
- Let two people enter a booth in seconds.
- Make synchronized capture reliable and delightful.
- Produce a beautiful final photo with minimal editing.
- Work well on mobile browsers.
- Require no app and no mandatory signup.
- Keep beta infrastructure cost close to zero.
- Keep photos private by default.

### Non-goals for MVP
No social network, chat, payments, accounts, AI generation, video calling, complex editor, >2-person sessions, or native apps.

## 3. Target Users
Primary: two friends, couples, siblings, classmates, coworkers, and event pairs.
Secondary: long-distance couples/friends and remote teams.

Users never need to identify their relationship.

## 4. Differentiation
**The photobooth for two.**

Differentiators:
- exactly two participants
- shared room
- synchronized capture
- remote two-device mode
- polished photobooth aesthetics
- browser-first
- no signup for MVP
- privacy-first local processing

Photobooth-IO demonstrates a clear layout → pose → review → customize → download journey. Roll Booth emphasizes browser-first photobooth aesthetics, filters/stickers, high-quality output, and local processing. These are UX references, not visual templates to copy.

## 5. Core Journeys

### Remote
Create room → share code/link → second person joins → both allow camera → both ready → host starts → synchronized 4-shot countdown → local composition → review/customize → download/share.

### Same device
Open booth → same-device mode → camera → position both people → 4-shot countdown → customize → download.

## 6. MVP Features

### Landing
Communicate immediately: photobooth, made for two, no app, no signup.
Primary CTA: **Create a Booth**
Secondary CTA: **Join a Booth**

### Room
- 6–8 character code
- shareable URL
- maximum 2 active participants
- ephemeral session identifiers
- expiration timestamp
- states: waiting, ready, capturing, completed, expired

### Join
Code/link plus optional display name. Third participant is rejected gracefully.

### Camera
Use MediaDevices API, video only, around 720p preview, front camera preferred on mobile, stop tracks when leaving.
Handle denied permission, missing camera, camera in use, rotation, backgrounding, and unsupported browsers.

### Readiness
Both participants must be Ready before remote capture. Clearly show connection, camera, and other-person status.

### Synchronized Capture
Use a future `targetAt` timestamp, client-side clock offset estimation, local countdown, capture near the target, and lightweight acknowledgement.
Do not capture immediately upon receiving a realtime message.
Target MVP tolerance: approximately ±150–250 ms.

### Four Shots
Default 4 photos with 3–2–1 countdown.

### Composition & Adaptive Canvas
Canvas API with dynamic sizing (`canvasW` and `canvasH`) based on photo aspect ratio (1:1, 3:4, 9:16) and layout (`single` 1x4, `twin` strip, `grid2x2` polaroid, `seamless` duo, `split` 8-slot) to guarantee 0% face clipping and authentic photostrip proportions.

### Customization & Enhancements
- Frames: Classic, Retro, Minimal, Polaroid.
- Color Filters: Original, Warm, B&W, Vintage.
- Decors: None, Sparkle, Ribbon, Hearts, Cats, Washi Tape.
- Live AR Accessories: Flower crown, Cat ears, Sunglasses, Party cone, Star glasses, Retro round glasses via `@mediapipe/tasks-vision`.
- Animated GIF Maker: 4-frame looping GIF export via `gifenc`.
- Clipboard Copy: One-click copy blob to clipboard.
- QR Code Sharing: Scan to join booth and scan to download result.

### Result
Dynamic preview, Download, Share via Web Share API, Clipboard Copy, Animated GIF Generation, QR Code Download, Retake. No mandatory upload.

## 7. Technical Architecture
Frontend: Next.js 16 (Turbopack), React 19, TypeScript, Tailwind CSS v4.
Realtime & Signaling: Supabase PostgreSQL + Realtime Presence & Broadcast Channels.
P2P Video Call: WebRTC via `RTCPeerConnection` with Metered.ca TURN server relay.
Computer Vision: `@mediapipe/tasks-vision` for client-side face landmark tracking.
Media Processing: HTML5 Canvas API + `gifenc` for GIF encoding.
Audio: Web Audio API Synthesizer (beep countdown and mechanical shutter).
Hosting: Vercel.

## 8. Data Model

### rooms
`id`, `code`, `host_session_id`, `status`, `created_at`, `expires_at`

### participants
`id`, `room_id`, `session_id`, `display_name`, `role`, `status`, `joined_at`, `last_seen_at`

### capture_sessions
`id`, `room_id`, `status`, `total_shots`, `current_shot`, `started_at`, `completed_at`

### captures
`id`, `session_id`, `sequence`, `participant_id`, `captured_at`, optional `storage_path`

### templates
`id`, `name`, `config JSONB`, `preview_path`, `is_active`

## 9. Realtime Protocol
Events: `participant_joined`, `participant_left`, `ready_changed`, `session_started`, `capture`, `capture_ack`, `retake`, `session_finished`, `room_ended`.

Only send coordination data. Never send images, base64 frames, video, or large payloads.

## 10. Security & Privacy
Principle: **Collect less. Store less. Transmit less. Delete sooner.**

- HTTPS for camera.
- Never expose service-role credentials.
- Use Supabase RLS.
- Room code is an identifier, not authorization.
- Validate inputs server-side.
- Do not record audio.
- Do not upload raw photos unless required.
- Expire rooms and clean temporary data.
- Avoid public photo URLs.

## 11. UX Principles
**Instant:** reach the booth quickly.
**Playful:** feel like a photobooth, not SaaS.
**Two-person first:** make participation obvious.
**Camera confidence:** always show camera/readiness/countdown state.
**Recovery:** Detect → Explain → Recover → Continue.

## 12. Mobile
Priority: Chrome Android, Safari iOS, desktop Chrome, desktop Safari/Firefox.
Support portrait, permissions, viewport changes, rotation, background/foreground, reconnect.

## 13. Performance
Fast landing page, quick camera start, local composition, no unnecessary uploads. Use 720p-class preview. Profile before introducing workers/OffscreenCanvas.

## 14. Analytics
Track: `room_created`, `room_joined`, `camera_ready`, `session_started`, `capture_completed`, `session_completed`, `result_generated`, `result_downloaded`, `result_shared`, `session_failed`.

For early beta, qualitative feedback is more valuable than complex analytics.

## 15. Success Metrics
Measure creation→join, camera readiness, completion, result generation, download/share, time-to-photo, and critical failure.
Initial targets: median time-to-photo <2 minutes; critical failure <10%.

## 16. MVP Backlog
- [ ] Next.js/TypeScript/Tailwind bootstrap
- [ ] Supabase schema + RLS
- [ ] Create/join room
- [ ] Presence/realtime
- [ ] Camera hook
- [ ] Ready state
- [ ] Clock offset + capture scheduler
- [ ] Four-shot flow
- [ ] Canvas composer
- [ ] Three templates
- [ ] Result/download/share
- [ ] Retake/reconnect
- [ ] Landing page polish
- [ ] Basic analytics

## 17. Acceptance Criteria
- A creates a booth and gets a code/link.
- B joins.
- Third participant is rejected.
- Camera works over HTTPS.
- Both readiness states synchronize.
- Host starts only when both are ready.
- Countdown is synchronized.
- Four captures complete.
- Final image is composed locally.
- Download works on Android Chrome and iOS Safari.
- Temporary disconnect does not silently corrupt the session.
- Expired rooms cannot be reused.
- Service-role credentials never reach the client.
- RLS prevents unauthorized room mutation.
- No photo/video travels through realtime.

## 18. North Star
> **Let two people create a memory that feels like they made it together.**

The technology should disappear. The countdown, poses, laughter, and final photo should be what users remember.
