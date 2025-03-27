interface Window {
  onSpotifyWebPlaybackSDKReady: () => void;
  Spotify: {
    Player: new (options: {
      name: string;
      getOAuthToken: (callback: (token: string) => void) => void;
      volume?: number;
    }) => Spotify.Player;
  };
}

declare namespace Spotify {
  interface Player {
    connect(): Promise<boolean>;
    disconnect(): void;
    addListener(
      event: "ready",
      callback: (state: { device_id: string }) => void
    ): void;
    addListener(
      event: "not_ready",
      callback: (state: { device_id: string }) => void
    ): void;
    addListener(
      event: "player_state_changed",
      callback: (state: {
        position: number;
        duration: number;
        track_window: {
          current_track: {
            name: string;
            album: {
              name: string;
              images: { url: string }[];
            };
            artists: { name: string }[];
          };
        };
        paused: boolean;
      }) => void
    ): void;
    addListener(
      event:
        | "initialization_error"
        | "authentication_error"
        | "account_error"
        | "playback_error",
      callback: (state: { message: string }) => void
    ): void;
    removeListener(event: string): void;
    pause(): Promise<void>;
    resume(): Promise<void>;
    togglePlay(): Promise<void>;
    seek(position_ms: number): Promise<void>;
    previousTrack(): Promise<void>;
    nextTrack(): Promise<void>;
    setVolume(volume: number): Promise<void>;
    getVolume(): Promise<number>;
  }
}
