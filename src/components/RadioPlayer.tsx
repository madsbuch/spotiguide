import { useEffect, useState, useRef, useCallback } from "react";
import { useStore } from "../store/useStore";
import { SpeechSegment } from "../store/types";

export default function RadioPlayer() {
  const {
    spotifyApi,
    selectedPlaylist,
    isPlaying,
    setIsPlaying,
    currentTrack,
    setCurrentTrack,
  } = useStore();

  const [player, setPlayer] = useState<Spotify.Player | null>(null);
  const [deviceId, setDeviceId] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [accessToken, setAccessToken] = useState<string>("");
  // We need volume for player initialization but don't need to change it
  const volume = 50;
  const progressInterval = useRef<number | null>(null);
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(
    null
  );
  const [isLoadingSpeech, setIsLoadingSpeech] = useState(false);
  const [speechSegments, setSpeechSegments] = useState<SpeechSegment[]>([]);
  const [currentSpeechSegment, setCurrentSpeechSegment] =
    useState<SpeechSegment | null>(null);
  // Always enable DJ mode, no toggle needed
  const isMixingEnabled = true;
  // Track if handleSpeechEnded has been called to prevent double execution
  const speechEndedCalled = useRef(false);
  // Track if event listeners are attached
  const eventListenersAttached = useRef(false);

  // Handle when speech segment finishes playing - using useCallback to ensure consistent reference
  const handleSpeechEnded = useCallback(async () => {
    console.log("🔊 handleSpeechEnded called");

    // Prevent double execution
    if (speechEndedCalled.current) {
      console.log("🔊 handleSpeechEnded already called, skipping");
      return;
    }

    if (!currentSpeechSegment) {
      console.log("No current speech segment, returning");
      return;
    }

    // Mark as called to prevent double execution
    speechEndedCalled.current = true;

    console.log("🔊 Speech segment ended, clearing and starting music");

    // Clear the current speech segment
    setCurrentSpeechSegment(null);

    // Force start music playback after speech ends
    if (currentTrack && spotifyApi && deviceId) {
      try {
        console.log(
          "🎵 Attempting to start music playback for track:",
          currentTrack.name
        );

        // Force start a new playback
        await spotifyApi.player.startResumePlayback(deviceId, undefined, [
          currentTrack.uri,
        ]);

        // Ensure playing state is updated
        setIsPlaying(true);

        console.log("🎵 Started playback after speech segment ended");
      } catch (err) {
        console.error("❌ Error starting playback after speech:", err);
        setError("Failed to start music after speech introduction.");
      } finally {
        // Reset the flag after a delay to allow for future speech segments
        setTimeout(() => {
          speechEndedCalled.current = false;
        }, 1000);
      }
    } else {
      console.error("❌ Missing required data to start playback:", {
        hasCurrentTrack: !!currentTrack,
        hasSpotifyApi: !!spotifyApi,
        hasDeviceId: !!deviceId,
      });
      // Reset the flag
      speechEndedCalled.current = false;
    }
  }, [
    currentSpeechSegment,
    currentTrack,
    spotifyApi,
    deviceId,
    setIsPlaying,
    setError,
  ]);

  // Get the access token when spotifyApi changes
  useEffect(() => {
    const getToken = async () => {
      if (!spotifyApi) return;

      try {
        // Get the access token
        const token = await spotifyApi.getAccessToken();
        if (token) {
          setAccessToken(
            typeof token === "string" ? token : token.access_token
          );
        }
      } catch (err) {
        console.error("Error getting access token:", err);
      }
    };

    getToken();
  }, [spotifyApi]);

  // Initialize audio element for speech playback
  useEffect(() => {
    console.log("🔄 Initializing audio element");
    const audio = new Audio();

    // Add event listener for when audio ends
    const onEnded = () => {
      console.log("🔊 Audio ended event fired directly");
      handleSpeechEnded();
    };

    audio.addEventListener("ended", onEnded);
    setAudioElement(audio);
    eventListenersAttached.current = true;

    return () => {
      console.log("🧹 Cleaning up audio element");
      audio.removeEventListener("ended", onEnded);
      audio.pause();
      eventListenersAttached.current = false;
    };
  }, [handleSpeechEnded]);

  // Initialize Spotify Web Playback SDK
  useEffect(() => {
    if (!accessToken) return;

    // Load the Spotify Web Playback SDK script
    const script = document.createElement("script");
    script.src = "https://sdk.scdn.co/spotify-player.js";
    script.async = true;
    document.body.appendChild(script);

    // Initialize the player when the SDK is loaded
    window.onSpotifyWebPlaybackSDKReady = () => {
      const player = new Spotify.Player({
        name: "Spotiguide Radio Player",
        getOAuthToken: (cb) => {
          cb(accessToken);
        },
        volume: volume / 100,
      });

      // Error handling
      player.addListener("initialization_error", ({ message }) => {
        console.error("Initialization error:", message);
        setError(`Player initialization error: ${message}`);
      });

      player.addListener("authentication_error", ({ message }) => {
        console.error("Authentication error:", message);
        setError(`Authentication error: ${message}`);
      });

      player.addListener("account_error", ({ message }) => {
        console.error("Account error:", message);
        setError(`Account error: ${message}. Premium required.`);
      });

      player.addListener("playback_error", ({ message }) => {
        console.error("Playback error:", message);
        setError(`Playback error: ${message}`);
      });

      // Playback status updates
      player.addListener("player_state_changed", (state) => {
        if (!state) return;

        // Update playing state
        setIsPlaying(!state.paused);

        // If the track ended, play the next one
        if (state.position === 0 && state.duration > 0 && state.paused) {
          handleNextTrack();
        }
      });

      // Ready
      player.addListener("ready", ({ device_id }) => {
        console.log("Ready with Device ID", device_id);
        setDeviceId(device_id);
      });

      // Not Ready
      player.addListener("not_ready", ({ device_id }) => {
        console.log("Device ID has gone offline", device_id);
        setDeviceId("");
      });

      // Connect to the player
      player.connect();
      setPlayer(player);
    };

    // Clean up
    return () => {
      if (player) {
        player.disconnect();
      }
      if (progressInterval.current) {
        window.clearInterval(progressInterval.current);
      }
      document.body.removeChild(script);
    };
  }, [accessToken]);

  // Fetch speech segments when a playlist is selected
  useEffect(() => {
    if (!selectedPlaylist || !isMixingEnabled) return;

    const fetchSpeechSegments = async () => {
      setIsLoadingSpeech(true);
      setError(null);

      try {
        // Create segments for each track in the playlist
        const segments: SpeechSegment[] = [];

        for (const track of selectedPlaylist.tracks) {
          // Create a unique ID for this segment
          const segmentId = `segment-${track.id}`;

          // Create a speech segment for this track
          segments.push({
            id: segmentId,
            text: `Now playing ${track.name} by ${track.artists.join(", ")}`,
            audioUrl: "https://n8n.lillefar.synology.me/webhook/spotiguide", // API endpoint URL
            duration: 5, // Estimated duration in seconds
          });
        }

        setSpeechSegments(segments);
      } catch (err) {
        console.error("Error creating speech segments:", err);
        setError("Failed to create speech content. Please try again later.");
      } finally {
        setIsLoadingSpeech(false);
      }
    };

    fetchSpeechSegments();
  }, [selectedPlaylist, isMixingEnabled]);

  // Start playback when a playlist is selected and device is ready
  useEffect(() => {
    if (!deviceId || !selectedPlaylist || !currentTrack || !spotifyApi) return;

    // If we're currently playing a speech segment, don't start music playback
    if (currentSpeechSegment) return;

    // If mixing is enabled, always play the speech segment first when a new track is selected
    if (isMixingEnabled) {
      const trackSpeechSegment = speechSegments.find(
        (segment) => segment.id === `segment-${currentTrack.id}`
      );

      // If there's a speech segment for this track, play it first
      if (trackSpeechSegment) {
        // Set the current speech segment to play the introduction
        setCurrentSpeechSegment(trackSpeechSegment);
        return;
      }
    }

    const startPlayback = async () => {
      try {
        // Start playback of the current track
        await spotifyApi.player.startResumePlayback(deviceId, undefined, [
          currentTrack.uri,
        ]);
        setIsPlaying(true);
      } catch (err) {
        console.error("Error starting playback:", err);
        setError(
          "Failed to start playback. Make sure you have Spotify Premium."
        );
      }
    };

    if (!isPlaying) {
      startPlayback();
    }
  }, [
    deviceId,
    currentTrack,
    selectedPlaylist,
    spotifyApi,
    currentSpeechSegment,
    isMixingEnabled,
    speechSegments,
  ]);

  // Start with the first track when a playlist is selected
  useEffect(() => {
    if (
      selectedPlaylist &&
      selectedPlaylist.tracks.length > 0 &&
      !currentTrack
    ) {
      console.log("Setting initial track from playlist");
      setCurrentTrack(selectedPlaylist.tracks[0]);

      // If mixing is enabled, also set the first speech segment
      if (isMixingEnabled && speechSegments.length > 0) {
        const firstTrackId = selectedPlaylist.tracks[0].id;
        const speechSegment = speechSegments.find(
          (segment) => segment.id === `segment-${firstTrackId}`
        );

        if (speechSegment) {
          setCurrentSpeechSegment(speechSegment);
        }
      }
    }
  }, [selectedPlaylist, speechSegments, isMixingEnabled]);

  // Play speech segment when it changes
  useEffect(() => {
    if (!audioElement || !currentSpeechSegment) return;

    // Reset the speech ended flag when a new speech segment starts
    speechEndedCalled.current = false;

    console.log("🔊 Speech segment changed, preparing to play speech");

    // Remove any existing event listeners to prevent duplicates
    if (eventListenersAttached.current) {
      console.log(
        "🧹 Removing existing event listeners before adding new ones"
      );
      const existingEndedHandler = audioElement.onended;
      if (existingEndedHandler) {
        audioElement.onended = null;
      }
    }

    const playSpeech = async () => {
      try {
        const trackId = currentSpeechSegment.id.replace("segment-", "");
        console.log("🔊 Playing speech for track:", trackId);

        // Make the API request
        const response = await fetch(
          "https://n8n.lillefar.synology.me/webhook/spotiguide",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ trackId }),
          }
        );

        if (!response.ok) {
          throw new Error(
            `Failed to fetch speech audio: ${response.statusText}`
          );
        }

        // Get the audio blob
        const audioBlob = await response.blob();
        console.log("🔊 Received audio blob:", audioBlob.type, audioBlob.size);

        if (audioBlob.size === 0) {
          throw new Error("Received empty audio response");
        }

        // Create an object URL for the blob
        const audioUrl = URL.createObjectURL(audioBlob);

        // Set the audio source
        audioElement.src = audioUrl;

        // Set up event listeners
        const onError = (e: Event) => {
          console.error("❌ Audio playback error:", e);
          setError("Failed to play audio. Format may not be supported.");
          URL.revokeObjectURL(audioUrl);
          handleSpeechEnded();
        };

        // Use onended instead of addEventListener to ensure only one handler
        audioElement.onended = () => {
          console.log("🔊 Audio ended event fired from onended property");
          handleSpeechEnded();
        };

        const onCanPlayThrough = async () => {
          try {
            // Remove the canplaythrough listener to prevent multiple calls
            audioElement.removeEventListener(
              "canplaythrough",
              onCanPlayThrough
            );

            await audioElement.play();
            console.log("🔊 Audio playback started successfully");

            // We'll rely on the onended property instead of using setInterval
            // This should prevent multiple calls to handleSpeechEnded
          } catch (playError) {
            console.error("❌ Error starting playback:", playError);
            setError("Failed to start audio playback.");
            handleSpeechEnded();
          }
        };

        // Add event listeners
        audioElement.addEventListener("error", onError);
        audioElement.addEventListener("canplaythrough", onCanPlayThrough);

        // Clean up function
        return () => {
          if (audioElement) {
            audioElement.removeEventListener("error", onError);
            audioElement.removeEventListener(
              "canplaythrough",
              onCanPlayThrough
            );
            // Clear the onended property
            audioElement.onended = null;
            if (audioElement.src.startsWith("blob:")) {
              URL.revokeObjectURL(audioElement.src);
            }
          }
        };
      } catch (err) {
        console.error("❌ Error playing speech:", err);
        setError(
          `Failed to play speech segment: ${
            err instanceof Error ? err.message : "Unknown error"
          }`
        );
        handleSpeechEnded(); // Move to next segment/track
        return undefined;
      }
    };

    // Execute the playSpeech function and store any cleanup function it returns
    let cleanupFn: (() => void) | undefined;
    playSpeech()
      .then((fn) => {
        cleanupFn = fn;
      })
      .catch((err) => {
        console.error("❌ Error in playSpeech promise:", err);
      });

    // Clean up function
    return () => {
      if (cleanupFn) cleanupFn();
      if (audioElement && audioElement.src.startsWith("blob:")) {
        URL.revokeObjectURL(audioElement.src);
      }
    };
  }, [currentSpeechSegment, audioElement, handleSpeechEnded]);

  // Move to the next track in the playlist
  const handleNextTrack = async () => {
    if (!selectedPlaylist || !currentTrack || !spotifyApi || !deviceId) return;

    const currentIndex = selectedPlaylist.tracks.findIndex(
      (track) => track.id === currentTrack.id
    );

    if (currentIndex < selectedPlaylist.tracks.length - 1) {
      // Move to the next track
      const nextTrack = selectedPlaylist.tracks[currentIndex + 1];
      setCurrentTrack(nextTrack);

      // If mixing is enabled, play a speech segment first
      if (isMixingEnabled) {
        // Find the corresponding speech segment for this track
        const speechSegment = speechSegments.find(
          (segment) => segment.id === `segment-${nextTrack.id}`
        );

        if (speechSegment) {
          setCurrentSpeechSegment(speechSegment);
          return; // Don't start playback yet, wait for speech to finish
        }
      }

      // Start playback of the next track if no speech or mixing disabled
      try {
        await spotifyApi.player.startResumePlayback(deviceId, undefined, [
          nextTrack.uri,
        ]);
      } catch (err) {
        console.error("Error playing next track:", err);
      }
    } else {
      // End of playlist, loop back to the first track
      const firstTrack = selectedPlaylist.tracks[0];
      setCurrentTrack(firstTrack);

      // If mixing is enabled, play a speech segment first
      if (isMixingEnabled) {
        // Find the corresponding speech segment for this track
        const speechSegment = speechSegments.find(
          (segment) => segment.id === `segment-${firstTrack.id}`
        );

        if (speechSegment) {
          setCurrentSpeechSegment(speechSegment);
          return; // Don't start playback yet, wait for speech to finish
        }
      }

      try {
        await spotifyApi.player.startResumePlayback(deviceId, undefined, [
          firstTrack.uri,
        ]);
      } catch (err) {
        console.error("Error looping playlist:", err);
      }
    }
  };

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
