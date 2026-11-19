# GitHub Data Cache

Automated hourly data pipeline powered by GitHub Actions that fetches my public GitHub profile metrics, public repositories, contributor avatars, and yearly contribution calendar, exporting them as static JSON files for zero rate limit frontend consumption on [oceanmallik.com](https://oceanmallik.com).

## Generated Endpoints

All files are automatically updated every hour and served globally via jsDelivr CDN:

* **Profile & Repositories (`data.json`)**
  `https://cdn.jsdelivr.net/gh/oceanmallik/github-data-cache@main/data.json`
* **Contribution Calendar (`contributions.json`)**
  `https://cdn.jsdelivr.net/gh/oceanmallik/github-data-cache@main/contributions.json`

## Data Structure

### `data.json`
Contains top level account stats and an array of all public repositories sorted by most recent push:
* `profile`: `name`, `login`, `avatar_url`, `html_url`, `public_repos`, `followers`, `following`
* `repos`: `id`, `name`, `description`, `language`, `fork`, `stargazers_count`, `forks_count`, `pushed_at`, `updated_at`, `html_url`, `homepage`, and `contributors` (`username`, `avatar_url`, `profile_url`)

### `contributions.json`
Contains GraphQL contribution calendar data covering the trailing 365 days (including private contribution counts):
* `totalContributions`: Total contribution count over the past year
* `weeks`: Array of weekly objects containing `contributionDays` (`date`, `contributionCount`, `contributionLevel`)

## Repository Structure

```text
.
├── .github/
│   └── workflows/
│       └── fetch-github-data.yml   # Hourly cron job, git commit, and jsDelivr cache purge
├── scripts/
│   └── fetch.mjs                   # Zero dependency Node.js REST & GraphQL fetcher
├── data.json                       # Auto generated profile and repository data
├── contributions.json              # Auto generated contribution graph data
└── README.md
