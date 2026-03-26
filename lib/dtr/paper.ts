/**
 * Word page dimensions use twips (1 inch = 1440 twips). Margins match the DTR template style (~0.47").
 */

export type PaperSizeId = 'a4' | 'letter' | 'folio' | 'legal'

export type PageLayoutTwips = {
  pgSzW: number
  pgSzH: number
  pgMarTop: number
  pgMarRight: number
  pgMarBottom: number
  pgMarLeft: number
  header: number
  footer: number
  gutter: number
}

/** Portrait sizes; uniform margins so left/right text area is symmetric. */
const M = {
  mar: 680,
  header: 720,
  footer: 720,
  gutter: 0,
} as const

/**
 * Presets aligned with Word defaults (pgSz in twips).
 * - A4: 210mm × 297mm
 * - Letter: 8.5" × 11"
 * - Folio: 8.5" × 13" (common PH / Word “Folio” height)
 * - Legal: 8.5" × 14"
 */
export const PAGE_LAYOUTS: Record<PaperSizeId, PageLayoutTwips> = {
  a4: {
    pgSzW: 11906,
    pgSzH: 16838,
    pgMarTop: M.mar,
    pgMarRight: M.mar,
    pgMarBottom: M.mar,
    pgMarLeft: M.mar,
    header: M.header,
    footer: M.footer,
    gutter: M.gutter,
  },
  letter: {
    pgSzW: 12240,
    pgSzH: 15840,
    pgMarTop: M.mar,
    pgMarRight: M.mar,
    pgMarBottom: M.mar,
    pgMarLeft: M.mar,
    header: M.header,
    footer: M.footer,
    gutter: M.gutter,
  },
  folio: {
    pgSzW: 12240,
    pgSzH: 18720,
    pgMarTop: M.mar,
    pgMarRight: M.mar,
    pgMarBottom: M.mar,
    pgMarLeft: M.mar,
    header: M.header,
    footer: M.footer,
    gutter: M.gutter,
  },
  legal: {
    pgSzW: 12240,
    pgSzH: 20160,
    pgMarTop: M.mar,
    pgMarRight: M.mar,
    pgMarBottom: M.mar,
    pgMarLeft: M.mar,
    header: M.header,
    footer: M.footer,
    gutter: M.gutter,
  },
}

export const DEFAULT_PAPER_SIZE: PaperSizeId = 'a4'

export const parsePaperSize = (value: unknown): PaperSizeId => {
  if (value === 'a4' || value === 'letter' || value === 'folio' || value === 'legal') return value
  return DEFAULT_PAPER_SIZE
}

/** Usable width for body text / full-width tables (twips). Gutter 0: symmetric left/right. */
export const getContentWidthTwips = (layout: PageLayoutTwips): number => {
  return layout.pgSzW - layout.pgMarLeft - layout.pgMarRight - layout.gutter
}
