const json = (res, status, body) => {
  res.status(status);
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
  res.send(JSON.stringify(body));
};

module.exports = async (_req, res) => {
  const output = { youtube: null, latestVideos: [], facebook: null, updatedAt: new Date().toISOString() };
  const jobs = [];

  if (process.env.YOUTUBE_API_KEY) {
    const params = new URLSearchParams({
      part: 'statistics,contentDetails',
      forHandle: 'Legaladda90',
      key: process.env.YOUTUBE_API_KEY,
    });
    jobs.push(fetch(`https://www.googleapis.com/youtube/v3/channels?${params}`)
      .then((response) => response.ok ? response.json() : null)
      .then(async (data) => {
        const channel = data?.items?.[0];
        const count = channel?.statistics?.subscriberCount;
        if (count != null) output.youtube = { subscriberCount: Number(count) };
        const uploadsPlaylist = channel?.contentDetails?.relatedPlaylists?.uploads;
        if (!uploadsPlaylist) return;
        const videosParams = new URLSearchParams({
          part: 'snippet,contentDetails',
          playlistId: uploadsPlaylist,
          maxResults: '6',
          key: process.env.YOUTUBE_API_KEY,
        });
        const videosResponse = await fetch(`https://www.googleapis.com/youtube/v3/playlistItems?${videosParams}`);
        const videosData = videosResponse.ok ? await videosResponse.json() : null;
        output.latestVideos = (videosData?.items || [])
          .filter((item) => item?.contentDetails?.videoId && item?.snippet?.title && item.snippet.title !== 'Private video')
          .map((item) => ({
            id: item.contentDetails.videoId,
            title: item.snippet.title,
            thumbnail: item.snippet.thumbnails?.high?.url || item.snippet.thumbnails?.medium?.url || item.snippet.thumbnails?.default?.url,
          }));
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
