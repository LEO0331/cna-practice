// Absolute site URL without a trailing slash. The deploy workflow sets SITE_URL,
// e.g. https://leo0331.github.io/cna-practice
export const siteUrl = (process.env.SITE_URL || "http://localhost:3000").replace(/\/$/, "");
