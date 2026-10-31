const json = (res, status, body) => {
  res.status(status);
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
  res.send(JSON.stringify(body));
};

module.exports = async (_req, res) => {
  const output = { youtube: null, featuredVideos: [], allVideos: [], facebook: null, updatedAt: new Date().toISOString() };
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
          maxResults: '50',
          key: process.env.YOUTUBE_API_KEY,
        });
        const videosResponse = await fetch(`https://www.googleapis.com/youtube/v3/playlistItems?${videosParams}`);
        const videosData = videosResponse.ok ? await videosResponse.json() : null;
        const uploads = (videosData?.items || [])
          .filter((item) => item?.contentDetails?.videoId && item?.snippet?.title && item.snippet.title !== 'Private video')
          .map((item) => ({
            id: item.contentDetails.videoId,
            title: item.snippet.title,
            thumbnail: item.snippet.thumbnails?.high?.url || item.snippet.thumbnails?.medium?.url || item.snippet.thumbnails?.default?.url,
            publishedAt: item.contentDetails.videoPublishedAt || item.snippet.publishedAt,
          }));
        const ids = uploads.map((video) => video.id).join(',');
        if (ids) {
          const viewParams = new URLSearchParams({ part: 'statistics', id: ids, key: process.env.YOUTUBE_API_KEY });
          const viewResponse = await fetch(`https://www.googleapis.com/youtube/v3/videos?${viewParams}`);
          const viewData = viewResponse.ok ? await viewResponse.json() : null;
          const views = new Map((viewData?.items || []).map((video) => [video.id, Number(video.statistics?.viewCount || 0)]));
          uploads.forEach((video) => { video.viewCount = views.get(video.id) || 0; });
        }
        const newest = uploads.slice(0, 2);
        const newestIds = new Set(newest.map((video) => video.id));
        const popular = uploads.filter((video) => !newestIds.has(video.id)).sort((a, b) => b.viewCount - a.viewCount).slice(0, 4);
        output.featuredVideos = [...newest, ...popular];
        output.allVideos = [...output.featuredVideos, ...uploads.filter((video) => !output.featuredVideos.some((featured) => featured.id === video.id))];
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
