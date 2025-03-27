import { SpotifyApi } from "@spotify/web-api-ts-sdk";

// Sample playlists with tracks
const samplePlaylists = [
  {
    id: "playlist1",
    name: "Chill Vibes",
    description: "Relaxing tunes for your day",
    images: [
      {
        url: "https://i.scdn.co/image/ab67706c0000da84fcb8b92f2615d3261b8eb146",
      },
    ],
    tracks: {
      items: [
        {
          track: {
            id: "track1",
            name: "Sunset Memories",
            artists: [{ name: "Chill Artist" }],
            album: {
              name: "Summer Vibes",
              images: [
                {
                  url: "https://i.scdn.co/image/ab67616d00001e02fe24e7386e7e9b6c754d5bde",
                },
              ],
            },
            uri: "spotify:track:track1",
          },
        },
        {
          track: {
            id: "track2",
            name: "Ocean Waves",
            artists: [{ name: "Beach Sounds" }],
            album: {
              name: "Coastal Dreams",
              images: [
                {
                  url: "https://i.scdn.co/image/ab67616d00001e02c559a84d5a91c0f3e32b536a",
                },
              ],
            },
            uri: "spotify:track:track2",
          },
        },
        {
          track: {
            id: "track3",
            name: "Mountain Air",
            artists: [{ name: "Nature Sounds" }, { name: "Ambient Music" }],
            album: {
              name: "Wilderness",
              images: [
                {
                  url: "https://i.scdn.co/image/ab67616d00001e02b1c4b76e23414c9f20242268",
                },
              ],
            },
            uri: "spotify:track:track3",
          },
        },
      ],
    },
  },
  {
    id: "playlist2",
    name: "Workout Mix",
    description: "High energy tracks to keep you motivated",
    images: [
      {
        url: "https://i.scdn.co/image/ab67706c0000da84a1d8a5c2c3c0a9728d0a3d3b",
      },
    ],
    tracks: {
      items: [
        {
          track: {
            id: "track4",
            name: "Power Up",
            artists: [{ name: "Energy Boost" }],
            album: {
              name: "Fitness Tracks",
              images: [
                {
                  url: "https://i.scdn.co/image/ab67616d00001e02d6d287cabee48972f983c0db",
                },
              ],
            },
            uri: "spotify:track:track4",
          },
        },
        {
          track: {
            id: "track5",
            name: "Run Faster",
            artists: [{ name: "Cardio Kings" }],
            album: {
              name: "Marathon Mix",
              images: [
                {
                  url: "https://i.scdn.co/image/ab67616d00001e02e8b066f70c206551210d902b",
                },
              ],
            },
            uri: "spotify:track:track5",
          },
        },
      ],
    },
  },
];

// Create a mock implementation of the Spotify API
export const createMockSpotifyApi = (): SpotifyApi => {
  return {
    // Authentication methods
    getAccessToken: async () => "mock-access-token",

    // User and playlist methods
    currentUser: {
      profile: async () => ({
        id: "mockuser",
        display_name: "Mock User",
        email: "mock@example.com",
        images: [],
        product: "premium",
      }),
      playlists: {
        playlists: async () => ({
          items: samplePlaylists,
        }),
      },
    },

    playlists: {
      getPlaylistItems: async (playlistId: string) => {
        const playlist = samplePlaylists.find((p) => p.id === playlistId);
        return playlist ? playlist.tracks : { items: [] };
      },
    },

    // Player methods
    player: {
      startResumePlayback: async () => ({}),
      pausePlayback: async () => ({}),
      getPlaybackState: async () => ({
        is_playing: true,
        progress_ms: 30000,
        item: {
          id: "track1",
          name: "Sunset Memories",
          artists: [{ name: "Chill Artist" }],
          duration_ms: 180000,
        },
      }),
    },
  } as unknown as SpotifyApi;
};
