# DESIGN.md — Two-Person Photobooth

## 1. Design Direction
Create a small, beautiful digital photobooth — not a SaaS dashboard and not a generic camera utility.

Use the polish, layout-first flow, playful photography and customization philosophy of modern browser photobooths as inspiration. Photobooth-IO emphasizes layout → pose → review → customize → download; Roll Booth emphasizes browser-first use, aesthetic treatments, filters/stickers and high-quality output. Build an original visual identity rather than copying either site.

## 2. Design Statement
> **A tiny digital photobooth made for two.**

Feel: playful, warm, modern, tactile, editorial, photographic, slightly nostalgic, effortless.

Avoid: corporate, overly romantic, childish, cluttered, dashboard-like.

## 3. Core Brand Idea
> **Two people. One booth. One memory.**

Use the number 2 subtly through paired cards, dual previews, mirrored elements and two-person compositions. Do not make it gimmicky.

## 4. Emotional Journey
Before: “Let's do this.”
During: “We're about to take it.”
After capture: “That one is actually cute.”
Result: “I want to save this.”

## 5. Typography
Display candidates: Fraunces, DM Serif Display, Instrument Serif, Playfair Display.
UI/body candidates: Inter, Geist, Manrope, DM Sans.

Recommended starting pair:
**Instrument Serif + Geist**

Use display typography selectively.

## 6. Color
Warm neutral foundation:
- Background `#F7F4EE`
- Surface `#FFFDF8`
- Text `#171717`
- Muted `#77736B`
- Border `#DDD8CE`
- Accent `#FF5C35`

Keep the interface neutral so photographs remain the hero.

## 7. Shape
Rounded but not bubbly:
- buttons 12–16px
- cards 20–28px
- photo frames 2–8px depending on template
- dialogs 24px

Prefer borders over heavy shadows.

## 8. Motion
Use motion to communicate physicality:
- button press
- countdown scale
- shutter flash
- card entrance
- template selection
- result reveal

Durations:
- micro: 120–180ms
- standard: 200–300ms
- major reveal: 350–500ms

Support reduced motion.

## 9. Homepage
Hero should answer what it is, why it is different, and what to click.

Example:
```text
          MADE
         FOR TWO.

    A little photobooth
    for you + someone.

    [ CREATE A BOOTH ]

    no app · no signup
```

Show a large sample photostrip or paired-photo visual.

Sections:
1. Hero
2. How it works
3. Designed for two
4. Templates
5. Remote mode
6. Final CTA

## 10. Create Booth
Keep it minimal:
```text
CREATE YOUR BOOTH

Who are you taking photos with?

       YOU + SOMEONE

[ CREATE BOOTH ]
```
Optional display name. No account creation.

## 11. Waiting Room
```text
YOUR BOOTH IS READY

       ABC 123

      [ QR ]

Share this with your person.

[ COPY LINK ]

YOU             ● READY
OTHER PERSON    ○ WAITING
```
When the second participant joins, use a subtle celebratory transition.

## 12. Ready State
```text
       BOTH IN THE BOOTH

      YOU       +      THEM

      ● READY          ● READY

            [ START ]
```

## 13. Capture Screen
Camera preview dominates the viewport.

Remote:
```text
┌─────────────────────────┐
│       YOUR CAMERA       │
├─────────────────────────┤
│       THEIR CAMERA      │
└─────────────────────────┘
             3
```

Same-device mode uses one large camera.

## 14. Countdown
Display a large:
`3` → `2` → `1` → `✦`

Use scale/opacity animation. Remove distracting controls during the final second.

## 15. Capture Feedback
Show shutter flash, captured thumbnail and progress such as:
`PHOTO 2 / 4`

Do not make users wait unnecessarily.

## 16. Result
The final image dominates:
```text
          YOU DID IT.

      ┌───────────────┐
      │   PHOTO STRIP │
      └───────────────┘

       [ DOWNLOAD ]
       [ SHARE ]
       [ RETAKE ]
```
It should feel like receiving a physical print.

## 17. Customization
Do not build Photoshop in MVP.

Use simple controls:
```text
FRAME
○ Classic
○ Retro
○ Minimal

STYLE
○ Original
○ B&W
○ Warm

DECOR
○ None
○ Sparkle
○ Tape
```

## 18. Templates
### Classic
Cream/white, vertical strip, simple typography.

### Retro
Warm paper tone, film grain, small date/caption.

### Minimal
Whitespace, thin border, editorial type.

### Polaroid
White frame, optional handwritten caption.

Templates should eventually be data-driven.

Suggested configuration:
```ts
type TemplateConfig = {
  id: string
  name: string
  canvas: { width: number; height: number }
  slots: Array<{
    x: number
    y: number
    width: number
    height: number
    radius?: number
  }>
  background: string
  typography?: object
  decorations?: object[]
}
```

## 19. Photo Treatments
Initial:
- Original
- Warm
- Black & White
- Vintage

Keep effects subtle.

## 20. UI Copy
Primary: `CREATE A BOOTH`
Secondary: `JOIN A BOOTH`
Capture: `START`
Result: `DOWNLOAD`
Share: `SHARE`
Retake: `TAKE ANOTHER`

Avoid technical words such as Initialize, Connect, Synchronize, Participant, Session.

## 21. States
Waiting:
> Waiting for your person...

Camera:
> We need your camera to step into the booth.

Unavailable:
> We can't find a camera on this device.

Connection:
> Looks like the connection slipped. Trying to bring you back in...

Other person:
> Your person stepped out for a moment.

Expired:
> This booth has closed.

Never expose raw technical errors.

## 22. Responsive Design
Mobile first: 320px+, 375px, 390px, 430px, tablet and desktop.
Desktop should be intentionally composed rather than a stretched mobile layout.

## 23. Accessibility
Use sufficient contrast, keyboard-accessible controls, visible focus, clear labels, reduced-motion support, meaningful ARIA labels, and do not communicate important state by color alone.

## 24. Design Tokens
Centralize colors, fonts, sizes, spacing, radii, shadows, motion and breakpoints. Avoid scattered magic values.

## 25. Component Principles
Useful product components:
- `BoothButton`
- `RoomCode`
- `ParticipantStatus`
- `CameraPreview`
- `Countdown`
- `CaptureProgress`
- `PhotoFrame`
- `TemplatePicker`
- `ResultActions`

Create components around meaningful product concepts, not arbitrary JSX size.

## 26. Anti-Patterns
Do not:
- copy competitor layouts
- overuse gradients
- make every element rounded
- overuse emoji
- put excessive UI around the camera
- hide the final photo behind tabs
- create dashboard navigation
- make users configure too much before taking a photo
- rely on generic stock photography for core product communication

## 27. Design North Star
> **Does this feel like a beautiful little photobooth for two?**

If not, simplify it.

The interface should disappear enough that the people and the photo become the focus.
