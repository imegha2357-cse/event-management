/**
 * Who runs EventOS, for the Privacy Policy and Terms pages.
 * The two pages (and the links to them) stay hidden until every field is filled in,
 * so a half-finished legal page is never shown.
 */
export const LEGAL = {
  /** Registered business name, e.g. "Levirix Technologies Private Limited". */
  operator: '',
  /** Postal address for legal notices. */
  address: '',
  /** Email for privacy questions and grievances. */
  email: '',
  /** City whose courts handle disputes, e.g. "Chennai". */
  courts: '',
  /** Date the current versions take effect, YYYY-MM-DD. */
  effective: '',
};

export const legalReady = Object.values(LEGAL).every(v => v.trim() !== '');
