export const APIFY_DAILY_ANALYZE_PLAN = {
  version: '2026-06-30',
  currency: 'USD',
  budget: {
    dailyMaxUsd: 1.25,
    softStopUsd: 1.05,
    emergencyStopUsd: 1.25,
    reserveUsd: 0.20,
  },
  defaults: {
    publicMaxItems: 100,
    ownedProfilePosts: {
      x: 5,
      facebook: 5,
      tiktok: 13,
      tiktokDisplay: 5,
      youtube: 5,
      instagramProfiles: 1,
      instagramDisplay: 5,
    },
    commentsPerPostBase: 20,
    commentsPerPostBoosted: 50,
    commentsPerPostMax: 100,
    maxCommentedPostsPerNetwork: 3,
  },
  escalationRules: [
    {
      name: 'engagement_boost',
      when: 'post.comments >= 100 || post.reactions >= 1000 || post.views >= 25000 || post.likes >= 2500',
      action: 'subir comentarios de 20 a 50 solo para ese post',
    },
    {
      name: 'risk_boost',
      when: 'clasificador_ia.sentiment === "negativo" || alerta.manual === true',
      action: 'subir comentarios de 50 a 100 solo si queda presupuesto',
    },
    {
      name: 'quiet_post_skip',
      when: 'post.comments < 10 && post.reactions < 100 && post.views < 5000',
      action: 'no extraer comentarios salvo que sea post oficial critico',
    },
  ],
  stages: [
    {
      key: 'public_listening',
      label: 'Escucha publica',
      hardCapUsd: 0.38,
      actors: [
        { key: 'x_search', actor: 'igolaizola/x-twitter-scraper-ppe', capUsd: 0.05, maxItems: 100 },
        { key: 'google_news', actor: 'sourabhbgp/google-news-scraper', capUsd: 0.02, maxItems: 10 },
        { key: 'tiktok_search', actor: 'sentry/tiktok-search-api', capUsd: 0.08, maxItems: 10 },
        { key: 'facebook_search', actor: 'igview-owner/facebook-old-posts-search', capUsd: 0.08, maxItems: 10 },
        {
          key: 'instagram_hashtags',
          actor: 'apify/instagram-scraper',
          capUsd: 0.10,
          maxItems: 15,
          params: {
            hashtags: ['pepeaguilar', 'pepeaguilarmusica', 'pepeaguilarvive'],
            onlyPostsNewerThan: '1 day',
            resultsType: 'posts',
          },
        },
      ],
    },
    {
      key: 'owned_posts',
      label: 'Posts propios',
      hardCapUsd: 0.18,
      actors: [
        { key: 'instagram_profile', actor: 'coderx/instagram-profile-scraper-api', capUsd: 0.01, maxItems: 1 },
        { key: 'facebook_posts', actor: 'unseenuser/fb-posts', capUsd: 0.05, maxItems: 5 },
        { key: 'tiktok_profile', actor: 'clockworks/tiktok-profile-scraper', capUsd: 0.04, maxItems: 13, displayItems: 5 },
        { key: 'youtube_rss', actor: 'youtube-channel-rss', capUsd: 0, maxItems: 5 },
        { key: 'x_profile', actor: 'scraper_one/x-profile-posts-scraper', capUsd: 0.04, maxItems: 5 },
      ],
    },
    {
      key: 'owned_comments',
      label: 'Comentarios propios',
      hardCapUsd: 0.49,
      actors: [
        { key: 'instagram_comments', actor: 'apify/instagram-comment-scraper', capUsd: 0.13, baseComments: 20, boostedComments: 50 },
        { key: 'facebook_comments', actor: 'apify/facebook-comments-scraper', capUsd: 0.12, baseComments: 20, boostedComments: 50 },
        { key: 'tiktok_comments', actor: 'clockworks/tiktok-comments-scraper', capUsd: 0.10, baseComments: 20, boostedComments: 50 },
        { key: 'youtube_comments', actor: 'apidojo/youtube-comments-scraper', capUsd: 0.08, baseComments: 20, boostedComments: 50 },
        { key: 'x_replies', actor: 'scraper_one/x-post-replies-scraper', capUsd: 0.10, baseComments: 20, boostedComments: 50 },
      ],
    },
    {
      key: 'ai_classification',
      label: 'Clasificacion IA',
      hardCapUsd: 0.20,
      note: 'reservado para sentimiento, tema, riesgo y aliados despues de guardar raw data',
    },
  ],
  stopRules: [
    'No iniciar un actor si estimatedSpentUsd + actor.capUsd > dailyMaxUsd.',
    'Si item_count == limit, aumentar limite solo si queda al menos 0.20 USD de reserva.',
    'No correr comentarios sobre posts sin URL real o sin fecha usable.',
    'No contar comentarios sin fecha exacta en porcentajes diarios.',
  ],
};

export function summarizeApifyDailyPlan(plan = APIFY_DAILY_ANALYZE_PLAN) {
  return {
    dailyMaxUsd: plan.budget.dailyMaxUsd,
    softStopUsd: plan.budget.softStopUsd,
    reserveUsd: plan.budget.reserveUsd,
    baseComments: plan.defaults.commentsPerPostBase,
    boostedComments: plan.defaults.commentsPerPostBoosted,
    maxCommentedPostsPerNetwork: plan.defaults.maxCommentedPostsPerNetwork,
    ownedProfilePosts: plan.defaults.ownedProfilePosts,
    stages: plan.stages.map(stage => ({
      key: stage.key,
      label: stage.label,
      hardCapUsd: stage.hardCapUsd,
    })),
  };
}
