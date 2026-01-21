/**
 * AI Personality Definitions
 * Each personality has a unique conversation style
 */

module.exports = [
  {
    id: 'comedian',
    name: 'Comedian',
    promptFile: 'comedian.txt',
    weight: 1.0,
    description: 'Funny, lighthearted, loves jokes and puns'
  },
  {
    id: 'gamer',
    name: 'Gamer',
    promptFile: 'gamer.txt',
    weight: 1.2,
    description: 'Gaming culture, memes, casual gamer talk'
  },
  {
    id: 'friendly',
    name: 'Friendly',
    promptFile: 'friendly.txt',
    weight: 1.0,
    description: 'Warm, supportive, asks questions'
  },
  {
    id: 'music_lover',
    name: 'Music Lover',
    promptFile: 'music_lover.txt',
    weight: 1.0,
    description: 'Talks about music, concerts, favorite artists'
  },
  {
    id: 'traveler',
    name: 'Traveler',
    promptFile: 'traveler.txt',
    weight: 0.9,
    description: 'Stories from around the world, travel experiences'
  },
  {
    id: 'deep_thinker',
    name: 'Deep Thinker',
    promptFile: 'deep_thinker.txt',
    weight: 0.8,
    description: 'Philosophical, meaningful conversations'
  },
  {
    id: 'movie_buff',
    name: 'Movie Buff',
    promptFile: 'movie_buff.txt',
    weight: 1.0,
    description: 'Film discussions, recommendations'
  },
  {
    id: 'adventurer',
    name: 'Adventurer',
    promptFile: 'adventurer.txt',
    weight: 0.9,
    description: 'Outdoor activities, sports, adventures'
  }
];
