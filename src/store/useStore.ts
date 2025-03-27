import { create } from "zustand";
import { StoreState } from "./types";

export const useStore = create<StoreState>((set) => ({
  spotifyApi: null,
  setSpotifyApi: (api) => set({ spotifyApi: api }),

  playlists: [],
  setPlaylists: (playlists) => set({ playlists }),

  selectedPlaylist: null,
  setSelectedPlaylist: (playlist) => set({ selectedPlaylist: playlist }),

  isPlaying: false,
  setIsPlaying: (isPlaying) => set({ isPlaying }),

  currentTrack: null,
  setCurrentTrack: (track) => set({ currentTrack: track }),

  speechSegments: [],
  setSpeechSegments: (segments) => set({ speechSegments: segments }),

  currentSpeechSegment: null,
  setCurrentSpeechSegment: (segment) => set({ currentSpeechSegment: segment }),

  isMixingEnabled: true,
  setIsMixingEnabled: (enabled) => set({ isMixingEnabled: enabled }),

  // Default backend URL - this should be updated based on your actual backend
  backendUrl: "http://localhost:3000",
  setBackendUrl: (url) => set({ backendUrl: url }),
}));
