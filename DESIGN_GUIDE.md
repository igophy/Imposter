# Imposter Design Guide

## Product context

**App purpose:** Imposter is a social party game for mobile where players secretly receive either the round word or the imposter role, pass the phone around, and then discuss who is bluffing.

**Target audience:** Friends, families, students, and casual groups who want a fast, low-friction game experience in Norwegian.

**Brand vibe:** Playful, suspenseful, energetic, clear, and social.

**Platform:** Mobile-first responsive web app that can later be packaged for iOS or Android.

## 1. Color palette

| Role | HEX | RGB | Usage |
| --- | --- | --- | --- |
| Primary | `#FF4757` | `rgb(255, 71, 87)` | Imposter identity, brand moments, danger/suspense states, primary buttons. |
| Secondary | `#2F3542` | `rgb(47, 53, 66)` | Deep neutral anchor for headers, text on light surfaces, and dark-mode structure. |
| Accent / CTA success | `#2ED573` | `rgb(46, 213, 115)` | Positive actions such as starting the game, revealing the starter, and completing a step. |
| Light background | `#F8FAFC` | `rgb(248, 250, 252)` | Future light mode app background. Keeps the interface clean and readable. |
| Dark background | `#1E2532` | `rgb(30, 37, 50)` | Current dark mode page background. Builds suspense without becoming pure black. |
| Dark surface | `#3A4354` | `rgb(58, 67, 84)` | Cards and screens on top of the dark background. |
| Primary text on dark | `#F8FAFC` | `rgb(248, 250, 252)` | Main text on dark backgrounds. |
| Secondary text on dark | `#CBD5E1` | `rgb(203, 213, 225)` | Supporting descriptions, hints, and quieter UI copy. |
| Primary text on light | `#1F2937` | `rgb(31, 41, 55)` | Main text for future light mode screens. |
| Secondary text on light | `#475569` | `rgb(71, 85, 105)` | Supporting copy in light mode. |

The palette pairs a high-energy red with a fresh green accent to reinforce the game's core emotional loop: suspicion versus confirmation. Blue-gray neutrals keep the interface modern and reduce eye strain during group play, while the off-white text color preserves strong contrast on dark surfaces.

## 2. Design methodology & system

### Recommended methodology: Atomic Design with user-centered validation

Use **Atomic Design** to keep the small mobile game maintainable while still moving quickly:

- **Atoms:** Color tokens, type scale, buttons, inputs, labels, and focus rings.
- **Molecules:** Player name input rows, secret word cards, pass-phone prompts, and result summaries.
- **Organisms:** Setup screen, names screen, reveal screen, play screen, and result screen.
- **Templates:** Round flow layout with a centered card, consistent spacing, and one dominant action per screen.
- **Pages/states:** Concrete gameplay states driven by `setup`, `names`, `pass`, `reveal`, `play`, and `result`.

Combine this with lightweight **user-centered design** checks: test the pass-the-phone flow with real groups, observe whether players understand when to hide/show the screen, and prioritize reducing accidental secret exposure.

### Recommended framework/guidelines

Because this is a mobile-first web game that may later become cross-platform, use:

- **Material Design 3 principles** for accessible color roles, state layers, touch targets, and spacing.
- **Progressive Web App-ready structure** if the app is later installable from mobile browsers.
- **Utility-token CSS** in the current single-file version, then migrate tokens into a theme file when the app grows.

### Suggested code structure as the app grows

```text
src/
  design/
    tokens.css          # colors, radius, spacing, shadows, typography
    themes.css          # light/dark mode mappings
  components/
    atoms/
      Button.js
      TextInput.js
    molecules/
      SecretCard.js
      PlayerNameList.js
    screens/
      SetupScreen.js
      NamesScreen.js
      PassScreen.js
      RevealScreen.js
      PlayScreen.js
      ResultScreen.js
  game/
    wordBank.js
    gameState.js
```

In the current `index.html`, keep design decisions centralized in CSS custom properties under `:root`. Avoid hard-coded colors in individual elements unless they are temporary inline styles being migrated.

## 3. Typography suggestions

- **Primary recommendation:** Use the system UI stack: `-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`. It loads instantly, feels native on iOS and Android, and works well for a party game where speed matters.
- **Google Fonts option:** Use **Inter** for body text and **Space Grotesk** for headings. Inter is highly readable on mobile, while Space Grotesk gives titles a playful, slightly mysterious personality.

Suggested scale:

- Display title: 40px / 700 / uppercase tracking.
- Screen heading: 28px / 700.
- Body: 16px-18px / 400-500.
- Button: 18px-19px / 700.

## 4. Accessibility rules and tools

1. **Contrast:** Maintain at least WCAG AA contrast: 4.5:1 for normal text and 3:1 for large text or non-text UI elements. Check every foreground/background token pair before adding it to the app.
2. **Touch targets:** Keep all interactive controls at least 44px by 44px, with enough spacing for players passing the device around quickly.
3. **Verification tools:** Use WebAIM Contrast Checker, Stark, or the Chrome/Edge DevTools Accessibility panel to validate colors, focus states, and readable text sizes.

## Implementation notes

The current app already uses CSS custom properties for its main palette. Continue extending those variables instead of scattering raw HEX values throughout the UI.
