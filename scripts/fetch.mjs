import fs from 'node:fs/promises';

const USERNAME = 'oceanmallik';
const TOKEN = process.env.GITHUB_TOKEN;

const headers = {
  Accept: 'application/vnd.github+json',
  'User-Agent': `${USERNAME}-portfolio-fetcher`,
  ...(TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {}),
};

async function fetchJson(url) {
  const res = await fetch(url, { headers });
  if (!res.ok) {
    throw new Error(`Failed ${url}: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

async function graphql(query, variables = {}) {
  const res = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: {
      ...headers,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!res.ok) {
    throw new Error(`GraphQL failed: ${res.status} ${res.statusText}`);
  }

  const json = await res.json();
  if (json.errors) {
    throw new Error(`GraphQL errors: ${JSON.stringify(json.errors)}`);
  }

  return json.data;
}

async function fetchAllContributions() {
  // 1. Fetch active contribution years and the default rolling last 365 days
  const overviewQuery = `
    query($login: String!) {
      user(login: $login) {
        contributionsCollection {
          contributionYears
          contributionCalendar {
            totalContributions
            weeks {
              contributionDays {
                date
                contributionCount
                contributionLevel
              }
            }
          }
        }
      }
    }
  `;

  const overviewData = await graphql(overviewQuery, { login: USERNAME });
  const collection = overviewData.user.contributionsCollection;
  const years = collection.contributionYears;
  const lastYear = collection.contributionCalendar;

  // 2. Fetch the calendar for each individual year
  const yearQuery = `
    query($login: String!, $from: DateTime!, $to: DateTime!) {
      user(login: $login) {
        contributionsCollection(from: $from, to: $to) {
          contributionCalendar {
            totalContributions
            weeks {
              contributionDays {
                date
                contributionCount
                contributionLevel
              }
            }
          }
        }
      }
    }
  `;

  const byYear = {};
  for (const year of years) {
    const from = `${year}-01-01T00:00:00Z`;
    const to = `${year}-12-31T23:59:59Z`;
    const yearData = await graphql(yearQuery, { login: USERNAME, from, to });
    byYear[year] = yearData.user.contributionsCollection.contributionCalendar;
  }

  return { years, lastYear, byYear };
}

async function run() {
  // 1. Fetch top card profile metrics
  const user = await fetchJson(`https://api.github.com/users/${USERNAME}`);

  // 2. Fetch all public repositories
  const rawRepos = await fetchJson(
    `https://api.github.com/users/${USERNAME}/repos?type=public&sort=pushed&per_page=100`
  );

  // 3. Fetch contributor icons for each repository
  const repos = await Promise.all(
    rawRepos.map(async (repo) => {
      let contributors = [];
      try {
        const contribData = await fetchJson(
          `https://api.github.com/repos/${USERNAME}/${repo.name}/contributors?per_page=10`
        );
        if (Array.isArray(contribData)) {
          contributors = contribData.map((c) => ({
            username: c.login,
            avatar_url: c.avatar_url,
            profile_url: c.html_url,
          }));
        }
      } catch {
        contributors = [];
      }

      return {
        id: repo.id,
        name: repo.name,
        description: repo.description,
        language: repo.language,
        fork: repo.fork,
        stargazers_count: repo.stargazers_count,
        forks_count: repo.forks_count,
        pushed_at: repo.pushed_at,
        updated_at: repo.updated_at,
        html_url: repo.html_url,
        homepage: repo.homepage || null,
        contributors,
      };
    })
  );

  const payload = {
    generated_at: new Date().toISOString(),
    profile: {
      name: user.name,
      login: user.login,
      avatar_url: user.avatar_url,
      html_url: user.html_url,
      public_repos: user.public_repos,
      followers: user.followers,
      following: user.following,
    },
    repos,
  };

  await fs.writeFile('data.json', JSON.stringify(payload, null, 2));

  // 4. Fetch and save multi year contributions.json
  const { years, lastYear, byYear } = await fetchAllContributions();
  await fs.writeFile(
    'contributions.json',
    JSON.stringify(
      {
        generated_at: new Date().toISOString(),
        years,
        lastYear,
        byYear,
      },
      null,
      2
    )
  );

  console.log(
    `Saved ${repos.length} repos and ${lastYear.totalContributions} rolling contributions across ${years.length} years`
  );
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
