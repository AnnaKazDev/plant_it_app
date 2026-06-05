# How to Switch Between Color Themes

In the `global.css` file you have two theme versions to choose from:

## 🅰️ THEME A: Sage Green (ACTIVE)
- Natural, muted colors
- Beige-cream background
- Sage green as primary
- Muted orange destructive

## 🅱️ THEME B: Monochrome (INACTIVE)
- Black & white colors
- Minimalist palette
- Original project theme

---

## How to Change Theme:

### To Activate THEME B:

1. Open `src/styles/global.css`
2. Find the section `/* ===== THEME A: Sage Green =====`
3. Select the entire THEME A section (`:root { ... }` and `.dark { ... }`)
4. Comment it out: add `/*` at the beginning and `*/` at the end
5. Find the section `/* ===== THEME B: Monochrome =====`
6. Uncomment the entire section: remove `/*` at the beginning and `*/` at the end
7. Save the file - changes will appear immediately (HMR)

### To Return to THEME A:

1. Comment out THEME B (add `/*` and `*/`)
2. Uncomment THEME A (remove `/*` and `*/`)
3. Save the file

---

## Adding a New Version (THEME C, D, etc.):

1. Copy the structure from THEME A or B
2. Change the header to `/* ===== THEME C: Name =====`
3. Adjust the oklch colors
4. Leave it commented out
5. Activate using the instructions above

---

**TIP:** Always make sure only ONE version is uncommented (active) at a time!
