import { useEffect, useState } from "react";
import { useStore } from "../store/useStore";
import { SpeechSegment, Track } from "../store/types";

// Separate hook for Spotify Web Playback SDK
function useSpotifyPlayer(accessToken: string) {
  const [player, setPlayer] = useState<Spotify.Player | null>(null);
  const [deviceId, setDeviceId] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const { setIsPlaying } = useStore();

  useEffect(() => {
    if (!accessToken) return;

    // Load the Spotify Web Playback SDK script
    const script = document.createElement("script");
    script.src = "https://sdk.scdn.co/spotify-player.js";
    script.async = true;
    document.body.appendChild(script);

    // Initialize the player when the SDK is loaded
    window.onSpotifyWebPlaybackSDKReady = () => {
      const newPlayer = new Spotify.Player({
        name: "Spotiguide Radio Player",
        getOAuthToken: (cb) => cb(accessToken),
        volume: 0.5, // 50% volume
      });

      // Error handling
      const errorTypes = [
        "initialization_error",
        "authentication_error",
        "account_error",
        "playback_error",
      ] as const;

      errorTypes.forEach((type) => {
        newPlayer.addListener(type, ({ message }) => {
          console.error(`${type}:`, message);
          setError(`${type.split("_").join(" ")}: ${message}`);
        });
      });

      // Playback status updates
      newPlayer.addListener("player_state_changed", (state) => {
        if (!state) return;
        setIsPlaying(!state.paused);
      });

      // Ready
      newPlayer.addListener("ready", ({ device_id }) => {
        console.log("Ready with Device ID", device_id);
        setDeviceId(device_id);
      });

      // Not Ready
      newPlayer.addListener("not_ready", ({ device_id }) => {
        console.log("Device ID has gone offline", device_id);
        setDeviceId("");
      });

      // Connect to the player
      newPlayer.connect();
      setPlayer(newPlayer);
    };

    // Clean up
    return () => {
      if (player) {
        player.disconnect();
      }
      document.body.removeChild(script);
    };
  }, [accessToken, setIsPlaying]);

  return { player, deviceId, error };
}

// Separate hook for speech audio handling
function useSpeechAudio(onSpeechEnded: () => void) {
  const [audioElement] = useState<HTMLAudioElement>(() => new Audio());

  useEffect(() => {
    const handleEnded = () => {
      console.log("🔊 Speech ended");
      onSpeechEnded();
    };

    audioElement.addEventListener("ended", handleEnded);

    return () => {
      audioElement.removeEventListener("ended", handleEnded);
      audioElement.pause();
      if (audioElement.src.startsWith("blob:")) {
        URL.revokeObjectURL(audioElement.src);
      }
    };
  }, [audioElement, onSpeechEnded]);

  const playSpeechSegment = async (segment: SpeechSegment): Promise<void> => {
    try {
      const trackId = segment.id.replace("segment-", "");
      console.log("🔊 Playing speech for track:", trackId);

      // Make the API request
      const response = await fetch(
        "https://n8n.lillefar.synology.me/webhook/spotiguide",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ trackId }),
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch speech audio: ${response.statusText}`);
      }

      // Get the audio blob
      const audioBlob = await response.blob();

      if (audioBlob.size === 0) {
        throw new Error("Received empty audio response");
      }

      // Create an object URL for the blob
      const audioUrl = URL.createObjectURL(audioBlob);

      // Clean up any previous blob URL
      if (audioElement.src.startsWith("blob:")) {
        URL.revokeObjectURL(audioElement.src);
      }

      // Set the audio source and play
      audioElement.src = audioUrl;
      await audioElement.play();

      return;
    } catch (err) {
      console.error("❌ Error playing speech:", err);
      throw err;
    }
  };

  return { audioElement, playSpeechSegment };
}

// Separate hook for speech segment management
function useSpeechSegments(selectedPlaylist: { tracks: Track[] } | null) {
  const [isLoadingSpeech, setIsLoadingSpeech] = useState(false);
  const [speechSegments, setSpeechSegments] = useState<SpeechSegment[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedPlaylist) return;

    const createSpeechSegments = async () => {
      setIsLoadingSpeech(true);
      setError(null);

      try {
        // Create segments for each track in the playlist
        const segments: SpeechSegment[] = selectedPlaylist.tracks.map(
          (track: Track) => ({
            id: `segment-${track.id}`,
            text: `Now playing ${track.name} by ${track.artists.join(", ")}`,
            audioUrl: "https://n8n.lillefar.synology.me/webhook/spotiguide",
            duration: 5, // Estimated duration in seconds
          })
        );

        setSpeechSegments(segments);
      } catch (err) {
        console.error("Error creating speech segments:", err);
        setError("Failed to create speech content. Please try again later.");
      } finally {
        setIsLoadingSpeech(false);
      }
    };

    createSpeechSegments();
  }, [selectedPlaylist]);

  return { speechSegments, isLoadingSpeech, error };
}

// Main RadioPlayer component
export default function RadioPlayer() {
  const {
    spotifyApi,
    selectedPlaylist,
    isPlaying,
    setIsPlaying,
    currentTrack,
    setCurrentTrack,
    setCurrentSpeechSegment,
    currentSpeechSegment,
  } = useStore();

  const [accessToken, setAccessToken] = useState<string>("");
  const [playerError, setPlayerError] = useState<string | null>(null);

  // Get the access token when spotifyApi changes
  useEffect(() => {
    const getToken = async () => {
      if (!spotifyApi) return;

      try {
        const token = await spotifyApi.getAccessToken();
        if (token) {
          setAccessToken(
            typeof token === "string" ? token : token.access_token
          );
        }
      } catch (err) {
        console.error("Error getting access token:", err);
        setPlayerError("Failed to get access token");
      }
    };

    getToken();
  }, [spotifyApi]);

  // Initialize Spotify player
  const {
    player,
    deviceId,
    error: spotifyPlayerError,
  } = useSpotifyPlayer(accessToken);

  // Handle speech ended event
  const handleSpeechEnded = async () => {
    if (!currentSpeechSegment || !currentTrack || !spotifyApi || !deviceId)
      return;

    setCurrentSpeechSegment(null);

    try {
      await spotifyApi.player.startResumePlayback(deviceId, undefined, [
        currentTrack.uri,
      ]);
      setIsPlaying(true);
    } catch (err) {
      console.error("❌ Error starting playback after speech:", err);
      setPlayerError("Failed to start music after speech introduction.");
    }
  };

  // Initialize speech audio
  const { playSpeechSegment } = useSpeechAudio(handleSpeechEnded);

  // Get speech segments for the playlist
  const {
    speechSegments,
    isLoadingSpeech,
    error: speechError,
  } = useSpeechSegments(selectedPlaylist);

  // Play speech segment when it changes
  useEffect(() => {
    if (!currentSpeechSegment) return;

    playSpeechSegment(currentSpeechSegment).catch((err) => {
      console.error("Failed to play speech segment:", err);
      setPlayerError(`Failed to play speech: ${err.message}`);
      // Move on to the music if speech fails
      handleSpeechEnded();
    });
  }, [currentSpeechSegment, handleSpeechEnded]);

  // Start with the first track when a playlist is selected
  useEffect(() => {
    if (
      selectedPlaylist?.tracks &&
      selectedPlaylist?.tracks?.length > 0 &&
      !currentTrack
    ) {
      const firstTrack = selectedPlaylist.tracks[0];
      setCurrentTrack(firstTrack);

      // Find the corresponding speech segment for this track
      const speechSegment = speechSegments.find(
        (segment) => segment.id === `segment-${firstTrack.id}`
      );

      if (speechSegment) {
        setCurrentSpeechSegment(speechSegment);
      }
    }
  }, [
    selectedPlaylist,
    speechSegments,
    currentTrack,
    setCurrentTrack,
    setCurrentSpeechSegment,
  ]);

  // Start playback when a track is selected and device is ready
  useEffect(() => {
    if (!deviceId || !selectedPlaylist || !currentTrack || !spotifyApi) return;

    // If we're currently playing a speech segment, don't start music playback
    if (currentSpeechSegment) return;

    // Find the corresponding speech segment for this track
    const trackSpeechSegment = speechSegments.find(
      (segment) => segment.id === `segment-${currentTrack.id}`
    );

    // If there's a speech segment for this track and we're not playing, play it
    if (trackSpeechSegment && !isPlaying) {
      setCurrentSpeechSegment(trackSpeechSegment);
      return;
    }

    // Otherwise start music playback if not already playing
    if (!isPlaying) {
      const startPlayback = async () => {
        try {
          await spotifyApi.player.startResumePlayback(deviceId, undefined, [
            currentTrack.uri,
          ]);
          setIsPlaying(true);
        } catch (err) {
          console.error("Error starting playback:", err);
          setPlayerError(
            "Failed to start playback. Make sure you have Spotify Premium."
          );
        }
      };

      startPlayback();
    }
  }, [
    deviceId,
    currentTrack,
    selectedPlaylist,
    spotifyApi,
    isPlaying,
    currentSpeechSegment,
    speechSegments,
    setCurrentSpeechSegment,
    setIsPlaying,
  ]);

  // Type guard function to check if playlist has tracks
  function hasValidTracks(playlist: any): playlist is { tracks: Track[] } {
    return (
      playlist && Array.isArray(playlist.tracks) && playlist.tracks.length > 0
    );
  }

  // Handle track navigation
  const handleNextTrack = async () => {
    if (!currentTrack || !selectedPlaylist) return;

    // Use type guard to ensure we have valid tracks
    if (!hasValidTracks(selectedPlaylist)) return;

    const tracks = selectedPlaylist.tracks;
    const currentIndex = tracks.findIndex(
      (track) => track.id === currentTrack.id
    );

    // Get next track (or loop back to first)
    const nextTrack =
      currentIndex < tracks.length - 1 ? tracks[currentIndex + 1] : tracks[0];

    setCurrentTrack(nextTrack);

    // Find speech segment for the next track
    const speechSegment = speechSegments.find(
      (segment) => segment.id === `segment-${nextTrack.id}`
    );

    if (speechSegment) {
      setCurrentSpeechSegment(speechSegment);
    } else if (spotifyApi && deviceId) {
      // If no speech segment, start music directly
      try {
        await spotifyApi.player.startResumePlayback(deviceId, undefined, [
          nextTrack.uri,
        ]);
        setIsPlaying(true);
      } catch (err) {
        console.error("Error playing next track:", err);
        setPlayerError("Failed to play next track");
      }
    }
  };

  // Listen for track ended events
  useEffect(() => {
    if (!spotifyApi || !deviceId || !player) return;

    const checkTrackEnded = (
      state: {
        position: number;
        duration: number;
        paused: boolean;
      } | null
    ) => {
      if (state && state.position === 0 && state.duration > 0 && state.paused) {
        handleNextTrack();
      }
    };

    player.addListener("player_state_changed", checkTrackEnded);

    return () => {
      player.removeListener("player_state_changed", checkTrackEnded);
    };
  }, [spotifyApi, deviceId, player, handleNextTrack]);

  // Determine what to render
  if (!spotifyApi || !selectedPlaylist) {
    return null;
  }

  if (isLoadingSpeech) {
    return (
      <div className="p-4 text-center bg-white/10 text-gray-200 rounded-lg">
        Loading speech content...
      </div>
    );
  }

  const error = playerError || spotifyPlayerError || speechError;
  if (error) {
    return (
      <div className="p-4 text-center bg-red-500/10 text-red-500 border border-red-500/30 rounded-lg">
        {error}
      </div>
    );
  }

  return (
    <div className="bg-spotify-black text-white rounded-xl shadow-xl p-6 max-w-md mx-auto border-4 border-gray-800">
      {/* Radio Header */}
      <div className="bg-gray-900 rounded-t-lg p-3 mb-4 border-b-2 border-gray-800">
        <h2 className="text-xl font-bold text-center text-spotify-green">
          Spotiguide Radio
        </h2>
      </div>

      {/* Radio Display */}
      {currentTrack && (
        <div className="bg-black/70 rounded-lg p-4 mb-4 border border-gray-800">
          <div className="flex items-center gap-3">
            {currentTrack.albumImageUrl && (
              <img
                src={currentTrack.albumImageUrl}
                alt={currentTrack.name}
                className="w-14 h-14 object-cover rounded border border-gray-700"
              />
            )}
            <div className="flex-1">
              <h3 className="font-bold mb-1 truncate text-spotify-green">
                {currentTrack.name}
              </h3>
              <p className="text-gray-300 text-sm">
                {currentTrack.artists.join(", ")}
              </p>
            </div>
          </div>

          {/* DJ Announcement Indicator */}
          {currentSpeechSegment && (
            <div className="bg-gray-900 border border-gray-700 rounded mt-3 p-2">
              <div className="flex items-center">
                <div className="w-3 h-3 bg-spotify-green rounded-full mr-2 animate-pulse"></div>
                <p className="text-spotify-green text-sm">On Air</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
