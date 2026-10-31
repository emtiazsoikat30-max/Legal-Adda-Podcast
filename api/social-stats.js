const json = (res, status, body) => {
  res.status(status);
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
  res.send(JSON.stringify(body));
};

module.exports = async (_req, res) => {
  const output = { youtube: null, facebook: null, updatedAt: new Date().toISOString() };
  const jobs = [];

  if (process.env.YOUTUBE_API_KEY) {
    const params = new URLSearchParams({
      part: 'statistics',
      forHandle: 'Legaladda90',
      key: process.env.YOUTUBE_API_KEY,
    });
    jobs.push(fetch(`https://www.googleapis.com/youtube/v3/channels?${params}`)
      .then((response) => response.ok ? response.json() : null)
      .then((data) => {
        const count = data?.items?.[0]?.statistics?.subscriberCount;
        if (count != null) output.youtube = { subscriberCount: Number(count) };
      }));
  }

  if (process.env.FACEBOOK_PAGE_ID && process.env.FACEBOOK_PAGE_ACCESS_TOKEN) {
    const version = process.env.FACEBOOK_GRAPH_VERSION || 'v22.0';
    const params = new URLSearchParams({
      fields: 'followers_count',
      access_token: process.env.FACEBOOK_PAGE_ACCESS_TOKEN,
    });
    jobs.push(fetch(`https://graph.facebook.com/${version}/${process.env.FACEBOOK_PAGE_ID}?${params}`)
      .then((response) => response.ok ? response.json() : null)
      .then((data) => {
        if (data?.followers_count != null) output.facebook = { followersCount: Number(data.followers_count) };
      }));
  }

  await Promise.allSettled(jobs);
  return json(res, 200, output);
};
