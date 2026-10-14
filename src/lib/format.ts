const nzd = new Intl.NumberFormat("en-NZ", { style: "currency", currency: "NZD", maximumFractionDigits: 0 });
const num = new Intl.NumberFormat("en-NZ", { maximumFractionDigits: 2 });
const dateFmt = new Intl.DateTimeFormat("en-NZ", { day: "numeric", month: "short", year: "numeric", timeZone: "Pacific/Auckland" });
const shortDate = new Intl.DateTimeFormat("en-NZ", { day: "numeric", month: "short", timeZone: "Pacific/Auckland" });

export const formatNzd = (v: number | null | undefined) => (v == null ? "—" : nzd.format(v));
export const formatNum = (v: number | null | undefined) => (v == null ? "—" : num.format(v));
export const formatDate = (d: Date | null | undefined) => (d ? dateFmt.format(d) : "—");
export const formatShortDate = (d: Date | null | undefined) => (d ? shortDate.format(d) : "—");
/** yyyy-mm-dd for <input type="date"> */
export const toDateInput = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : "");
export const pct = (v: number | null | undefined) => (v == null ? "—" : `${Math.round(v * 100)}%`);
