import {defineTheme} from '@astryxdesign/core/theme';
import {neutralTheme} from '@astryxdesign/theme-neutral';

/**
 * GoldPrism — the brand kit expressed as an Astryx theme.
 *
 * Paper under ink. Gold is the residual that survives costs, so it is an
 * accent for meaning, never a surface wash. Depth comes from hard rules and
 * offset shadows, not blur. Corners stay at 2px; there are no pills.
 */
export const goldprismTheme = defineTheme({
  name: 'goldprism',
  extends: neutralTheme,

  typography: {
    scale: {base: 16, ratio: 1.25},
    // Roles point at the next/font variables rather than a literal webfont
    // name: the families are loaded by the app, not by a theme stylesheet.
    body: {
      family: 'var(--font-plex-sans)',
      fallbacks: '"Segoe UI", system-ui, sans-serif',
    },
    heading: {
      family: 'var(--font-plex-serif)',
      fallbacks: 'Georgia, serif',
      weight: 'medium',
      weights: {1: 'medium', 2: 'medium', 3: 'medium', 4: 'medium'},
    },
    code: {
      family: 'var(--font-plex-mono)',
      fallbacks: 'Consolas, ui-monospace, monospace',
    },
  },

  // 2px unit: inner 2, element 2, container 2. The scale stops at the brand
  // radius before the multiplier even applies.
  radius: {base: 2, multiplier: 1},

  motion: {fast: 120, medium: 240, slow: 600, ratio: 0.75},

  tokens: {
    /* Type — next/font writes --font-plex-* on <body>, so the theme stacks
       carry the reference and resolve on each rendered element. */
    '--font-family-body': 'var(--font-plex-sans), "Segoe UI", sans-serif',
    '--font-family-heading': 'var(--font-plex-serif), Georgia, serif',
    '--font-family-code': 'var(--font-plex-mono), Consolas, monospace',

    /* Ground — assay paper, crucible ink, vellum cards. */
    '--color-background-body': ['#F0EADB', '#14110D'],
    '--color-background-surface': ['#F0EADB', '#14110D'],
    '--color-background-card': ['#E4DCC8', '#2E2B26'],
    '--color-background-popover': ['#F0EADB', '#2E2B26'],
    '--color-background-muted': ['#E4DCC8', '#3C3832'],
    '--color-background-inverted': ['#14110D', '#F0EADB'],

    /* Ink — slag ramp. */
    '--color-text-primary': ['#14110D', '#F0EADB'],
    '--color-text-secondary': ['#524C40', '#A89F8C'],
    '--color-text-disabled': ['#8A8272', '#6F6859'],
    '--color-icon-primary': ['#14110D', '#F0EADB'],
    '--color-icon-secondary': ['#524C40', '#A89F8C'],

    /* Accent — ink, because the primary action is an assay mark, not a
       gold fill. Links and focus carry the gold ink instead. */
    '--color-accent': ['#14110D', '#F0EADB'],
    '--color-on-accent': ['#F0EADB', '#14110D'],
    '--color-accent-muted': [
      'rgba(208, 154, 28, 0.18)',
      'rgba(208, 154, 28, 0.22)',
    ],
    '--color-text-accent': ['#7A5608', '#D09A1C'],
    '--color-icon-accent': ['#7A5608', '#D09A1C'],

    /* Rules — 1px hairline, never a soft glow. */
    '--color-border': ['#CBC1A8', 'rgba(240, 234, 219, 0.20)'],
    '--color-border-emphasized': ['#A89F8C', '#524C40'],
    '--color-skeleton': ['#E4DCC8', '#3A352C'],
    '--color-track': ['#CBC1A8', '#3A352C'],

    /* Overlays and tint. */
    '--color-neutral': ['rgba(20, 17, 13, 0.10)', 'rgba(240, 234, 219, 0.16)'],
    '--color-tint-hover': ['#14110D', '#F0EADB'],
    '--color-overlay': ['rgba(20, 17, 13, 0.35)', 'rgba(0, 0, 0, 0.55)'],
    '--color-overlay-hover': [
      'rgba(20, 17, 13, 0.05)',
      'rgba(240, 234, 219, 0.05)',
    ],
    '--color-overlay-pressed': [
      'rgba(20, 17, 13, 0.10)',
      'rgba(240, 234, 219, 0.10)',
    ],
    '--color-shadow': ['rgba(20, 17, 13, 0.12)', 'rgba(0, 0, 0, 0.50)'],

    /* Status — verdigris trades, flux watches, oxide is blocked. */
    '--color-success': ['#2E6F57', '#4FA383'],
    '--color-on-success': ['#F0EADB', '#14110D'],
    '--color-success-muted': [
      'rgba(46, 111, 87, 0.16)',
      'rgba(79, 163, 131, 0.20)',
    ],
    '--color-warning': ['#A8610F', '#D98B2B'],
    '--color-on-warning': ['#F0EADB', '#14110D'],
    '--color-warning-muted': [
      'rgba(168, 97, 15, 0.16)',
      'rgba(217, 139, 43, 0.20)',
    ],
    '--color-error': ['#A23A24', '#D9644A'],
    '--color-on-error': ['#F0EADB', '#14110D'],
    '--color-error-muted': [
      'rgba(162, 58, 36, 0.16)',
      'rgba(217, 100, 74, 0.20)',
    ],
    '--color-text-success': ['#2E6F57', '#4FA383'],
    '--color-text-warning': ['#80541E', '#D98B2B'],
    '--color-text-error': ['#82311F', '#D9644A'],
    '--color-text-info': ['#285A46', '#83A896'],

    /* Shape — brand corners on every scale step. */
    '--radius-inner': '2px',
    '--radius-element': '2px',
    '--radius-container': '2px',
    '--radius-page': '2px',
    '--radius-chat': '2px',
    '--radius-full': '2px',
    '--border-width': '1px',

    /* Depth — offset solids, the way a stamped assay card sits on a desk. */
    '--shadow-low': '2px 2px 0 0 light-dark(#14110D, #000000)',
    '--shadow-med': '4px 4px 0 0 light-dark(#14110D, #000000)',
    '--shadow-high': '6px 6px 0 0 light-dark(#14110D, #000000)',
    '--shadow-inset-hover':
      'inset 0 0 0 1px light-dark(#A89F8C, #524C40)',
    '--shadow-inset-selected':
      'inset 0 0 0 2px light-dark(#7A5608, #D09A1C)',

    /* Focus — a gold rule around whatever holds the keyboard. */
    '--focus-outline-width': '2px',
    '--focus-outline-style': 'solid',
    '--focus-outline-offset': '2px',
    '--focus-outline-color': 'light-dark(#7A5608, #D09A1C)',
  },

  components: {
    button: {
      base: {
        borderRadius: '2px',
        fontWeight: 'var(--font-weight-semibold)',
        letterSpacing: '0.02em',
      },
    },
    card: {
      base: {borderRadius: '2px', borderWidth: '1px'},
    },
    badge: {
      base: {
        borderRadius: '2px',
        borderWidth: '1px',
        borderStyle: 'solid',
        borderColor: 'currentColor',
        backgroundColor: 'transparent',
        fontFamily: 'var(--font-family-code)',
        fontSize: '10px',
        fontWeight: 'var(--font-weight-medium)',
        letterSpacing: '0.1em',
        lineHeight: '1',
        paddingBlock: '5px',
        paddingInline: '6px',
        textTransform: 'uppercase',
      },
      'variant:warning': {
        color: 'var(--color-text-warning)',
      },
    },
    // Table headings are instrument labels: mono, caps, tracked out.
    'table-header-cell': {
      base: {
        fontFamily: 'var(--font-family-code)',
        fontSize: '10px',
        fontWeight: 'var(--font-weight-medium)',
        letterSpacing: '0.12em',
        textTransform: 'uppercase',
        color: 'var(--color-text-secondary)',
      },
    },
    // Dense data reads in the instrument face, at supporting scale.
    'table-cell': {
      base: {
        fontFamily: 'var(--font-family-code)',
        fontSize: 'var(--text-supporting-size)',
        lineHeight: '1.45',
        fontVariantNumeric: 'tabular-nums',
      },
    },
  },
});
