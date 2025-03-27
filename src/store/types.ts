import { SpotifyApi } from "@spotify/web-api-ts-sdk";

export interface Track {
  id: string;
  name: string;
  artists: string[];
  uri: string;
  albumImageUrl: string;
}

export interface Playlist {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  tracks: Track[];
}

export interface SpeechSegment {
  id: string;
  text: string;
  audioUrl: string;
  duration: number;
}

export interface StoreState {
  spotifyApi: SpotifyApi | null;
  setSpotifyApi: (api: SpotifyApi | null) => void;

  playlists: Playlist[];
  setPlaylists: (playlists: Playlist[]) => void;

  selectedPlaylist: Playlist | null;
  setSelectedPlaylist: (playlist: Playlist | null) => void;

  isPlaying: boolean;
  setIsPlaying: (isPlaying: boolean) => void;

  currentTrack: Track | null;
  setCurrentTrack: (track: Track | null) => void;

  speechSegments: SpeechSegment[];
  setSpeechSegments: (segments: SpeechSegment[]) => void;

  currentSpeechSegment: SpeechSegment | null;
  setCurrentSpeechSegment: (segment: SpeechSegment | null) => void;

  isMixingEnabled: boolean;
  setIsMixingEnabled: (enabled: boolean) => void;

  backendUrl: string;
  setBackendUrl: (url: string) => void;
}
