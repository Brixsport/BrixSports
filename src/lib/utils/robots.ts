/**
 * robots.txt
 * 
 * Controls search engine crawler access to Brixsport website
 * 
 * Rules:
 * - Allow all crawlers to index public content
 * - Disallow admin, API, and private routes
 * - Point to sitemap for efficient crawling
 */

const robotsTxt = `
# robots.txt for Brixsport - Nigerian University Sports Platform
# https://brixsport.com

User-agent: *
Allow: /

# Disallow admin and private areas
Disallow: /admin/
Disallow: /admin/*
Disallow: /api/
Disallow: /api/*
Disallow: /auth/
Disallow: /login
Disallow: /signup
Disallow: /forgot-password
Disallow: /reset-password
Disallow: /profile/settings
Disallow: /profile/

# Disallow private user data
Disallow: /notifications
Disallow: /favourites
Disallow: /dashboard

# Allow specific API endpoints that provide public data
Allow: /api/matches/
Allow: /api/competitions/
Allow: /api/teams/
Allow: /api/players/
Allow: /api/news/

# Sitemap location
Sitemap: https://brixsport.com/sitemap.xml

# Crawl rate suggestion
Crawl-delay: 1
`;

export default robotsTxt;
