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

async function run() {
  // 1. Fetch top card profile metrics
  const user = await fetchJson(`https://api.github.com/users/${USERNAME}`);

  // 2. Fetch all public repositories (up to 100, sorted by most recently pushed)
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
        // Empty repositories return 204/404 for contributors; default to empty array
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
  console.log(`Saved ${repos.length} repositories to data.json`);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
