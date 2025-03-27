import { useEffect, useState, useRef } from "react";
import { useStore } from "../store/useStore";
import { SpeechSegment } from "../store/types";
import {
  FaForward,
  FaBackward,
  FaPlay,
  FaPause,
  FaMicrophone,
  FaMicrophoneSlash,
} from "react-icons/fa";

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
  const [isMixingEnabled, setIsMixingEnabled] = useState(true);

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
    const audio = new Audio();
    audio.addEventListener("ended", handleSpeechEnded);
    setAudioElement(audio);

    return () => {
      audio.removeEventListener("ended", handleSpeechEnded);
      audio.pause();
    };
  }, []);

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

        // We don't need to track duration anymore

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

        // We don't need progress tracking anymore
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

    // We no longer pause Spotify playback when speech is playing
    // This allows music to continue playing during speech

    const playSpeech = async () => {
      try {
        const trackId = currentSpeechSegment.id.replace("segment-", "");
        console.log("Playing speech for track:", trackId);

        // Set up a timeout to handle API not responding
        // The API is expected to take quite a while, so we use a longer timeout
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error("API request timed out")), 60000); // Increased to 60 seconds
        });

        // Make the API request
        const fetchPromise = fetch(
          "https://n8n.lillefar.synology.me/webhook/spotiguide",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ trackId }),
          }
        );

        // Race the fetch against the timeout
        const response = (await Promise.race([
          fetchPromise,
          timeoutPromise,
        ])) as Response;

        if (!response.ok) {
          throw new Error(
            `Failed to fetch speech audio: ${response.statusText}`
          );
        }

        // Get the audio blob
        const audioBlob = await response.blob();
        console.log("Received audio blob:", audioBlob.type, audioBlob.size);

        if (audioBlob.size === 0) {
          throw new Error("Received empty audio response");
        }

        // Create an object URL for the blob
        const audioUrl = URL.createObjectURL(audioBlob);

        // Set the audio source
        audioElement.src = audioUrl;

        // Set up event listeners
        const onError = (e: Event) => {
          console.error("Audio playback error:", e);
          setError("Failed to play audio. Format may not be supported.");
          URL.revokeObjectURL(audioUrl);
          handleSpeechEnded();
        };

        const onCanPlayThrough = async () => {
          try {
            audioElement.removeEventListener(
              "canplaythrough",
              onCanPlayThrough
            );
            await audioElement.play();
            console.log("Audio playback started successfully");

            // Add a manual check to ensure the song starts after speech ends
            // This is a fallback in case the 'ended' event doesn't fire properly
            const checkEnded = () => {
              if (audioElement && (audioElement.ended || audioElement.paused)) {
                console.log("Audio ended check - triggering handleSpeechEnded");
                clearInterval(checkInterval);
                handleSpeechEnded();
              }
            };

            const checkInterval = setInterval(checkEnded, 1000);

            // Also ensure we clear the interval when audio ends normally
            const onEnded = () => {
              console.log("Audio ended event fired");
              clearInterval(checkInterval);
              if (audioElement) {
                audioElement.removeEventListener("ended", onEnded);
              }
            };

            if (audioElement) {
              audioElement.addEventListener("ended", onEnded);
            }

            // Return a cleanup function that includes clearing the interval
            return () => {
              clearInterval(checkInterval);
              if (audioElement) {
                audioElement.removeEventListener("ended", onEnded);
              }
            };
          } catch (playError) {
            console.error("Error starting playback:", playError);
            setError("Failed to start audio playback.");
            handleSpeechEnded();
            return undefined;
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
            if (audioElement.src.startsWith("blob:")) {
              URL.revokeObjectURL(audioElement.src);
            }
          }
        };
      } catch (err) {
        console.error("Error playing speech:", err);
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
        console.error("Error in playSpeech promise:", err);
      });

    // Clean up function
    return () => {
      if (cleanupFn) cleanupFn();
      if (audioElement && audioElement.src.startsWith("blob:")) {
        URL.revokeObjectURL(audioElement.src);
      }
    };
  }, [currentSpeechSegment, audioElement, isPlaying, player]);

  // Handle when speech segment finishes playing
  const handleSpeechEnded = async () => {
    console.log("handleSpeechEnded called");
    if (!currentSpeechSegment) {
      console.log("No current speech segment, returning");
      return;
    }

    // Clear the current speech segment
    setCurrentSpeechSegment(null);

    // If music isn't already playing, start it
    if (!isPlaying && currentTrack && spotifyApi && deviceId) {
      try {
        console.log(
          "Attempting to start music playback for track:",
          currentTrack.name
        );

        // Start a new playback
        await spotifyApi.player.startResumePlayback(deviceId, undefined, [
          currentTrack.uri,
        ]);
        setIsPlaying(true);

        console.log("Started playback after speech segment ended");
      } catch (err) {
        console.error("Error starting playback after speech:", err);
        setError("Failed to start music after speech introduction.");
      }
    } else {
      console.error("Missing required data to start playback:", {
        hasCurrentTrack: !!currentTrack,
        hasSpotifyApi: !!spotifyApi,
        hasDeviceId: !!deviceId,
      });
    }
  };

  // Toggle play/pause state
  const togglePlayPause = async () => {
    if (!player) return;

    // If we're currently playing a speech segment, don't change the state
    if (currentSpeechSegment) return;

    try {
      if (isPlaying) {
        await player.pause();
      } else {
        await player.resume();
      }
      setIsPlaying(!isPlaying);
    } catch (err) {
      console.error("Error toggling playback:", err);
    }
  };

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

  // Move to the previous track in the playlist
  const handlePreviousTrack = async () => {
    if (!selectedPlaylist || !currentTrack || !spotifyApi || !deviceId) return;

    const currentIndex = selectedPlaylist.tracks.findIndex(
      (track) => track.id === currentTrack.id
    );

    if (currentIndex > 0) {
      // Move to the previous track
      const prevTrack = selectedPlaylist.tracks[currentIndex - 1];
      setCurrentTrack(prevTrack);

      // If mixing is enabled, play a speech segment first
      if (isMixingEnabled) {
        // Find the corresponding speech segment for this track
        const speechSegment = speechSegments.find(
          (segment) => segment.id === `segment-${prevTrack.id}`
        );

        if (speechSegment) {
          setCurrentSpeechSegment(speechSegment);
          return; // Don't start playback yet, wait for speech to finish
        }
      }

      // Start playback of the previous track
      try {
        await spotifyApi.player.startResumePlayback(deviceId, undefined, [
          prevTrack.uri,
        ]);
      } catch (err) {
        console.error("Error playing previous track:", err);
      }
    } else {
      // Beginning of playlist, loop to the last track
      const lastTrack =
        selectedPlaylist.tracks[selectedPlaylist.tracks.length - 1];
      setCurrentTrack(lastTrack);

      // If mixing is enabled, play a speech segment first
      if (isMixingEnabled) {
        // Find the corresponding speech segment for this track
        const speechSegment = speechSegments.find(
          (segment) => segment.id === `segment-${lastTrack.id}`
        );

        if (speechSegment) {
          setCurrentSpeechSegment(speechSegment);
          return; // Don't start playback yet, wait for speech to finish
        }
      }

      try {
        await spotifyApi.player.startResumePlayback(deviceId, undefined, [
          lastTrack.uri,
        ]);
      } catch (err) {
        console.error("Error looping to last track:", err);
      }
    }
  };

  // We don't need these functions anymore as we've simplified the UI

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
    <div className="bg-gray-800 text-white rounded-xl shadow-xl p-6 max-w-md mx-auto">
      {/* Content */}
      <div>
        <h2 className="text-xl font-bold mb-4 text-center border-b border-white/10 pb-2">
          Spotify Radio
        </h2>

        {currentTrack && (
          <div>
            <div className="flex items-center gap-4 mb-4">
              {currentTrack.albumImageUrl && (
                <img
                  src={currentTrack.albumImageUrl}
                  alt={currentTrack.name}
                  className="w-16 h-16 object-cover rounded-lg"
                />
              )}
              <div className="flex-1">
                <h3 className="font-bold mb-1 truncate">{currentTrack.name}</h3>
                <p className="text-gray-300 text-sm">
                  {currentTrack.artists.join(", ")}
                </p>
              </div>
            </div>

            {currentSpeechSegment && (
              <div className="bg-blue-900/20 border border-blue-700/30 rounded-lg p-3 mb-4">
                <div className="flex items-center mb-1">
                  <div className="w-2 h-2 bg-blue-400 rounded-full mr-2 animate-pulse"></div>
                  <p className="text-blue-300 text-sm">Radio DJ Announcement</p>
                </div>
              </div>
            )}

            {spotifyApi && currentTrack && accessToken && (
              <div className="mt-4">
                <div className="p-3 bg-gray-700 rounded-lg">
                  {/* Controls - simplified */}
                  <div className="flex justify-center items-center gap-8">
                    <button
                      onClick={handlePreviousTrack}
                      className="text-white hover:text-green-400 transition-colors p-2"
                    >
                      <FaBackward />
                    </button>

                    <button
                      onClick={togglePlayPause}
                      className="bg-green-600 hover:bg-green-700 text-white p-3 rounded-full transition-colors flex items-center justify-center"
                    >
                      {isPlaying ? <FaPause size={14} /> : <FaPlay size={14} />}
                    </button>

                    <button
                      onClick={handleNextTrack}
                      className="text-white hover:text-green-400 transition-colors p-2"
                    >
                      <FaForward />
                    </button>
                  </div>
                </div>

                {/* Mixing toggle - simplified */}
                <div className="mt-4">
                  <button
                    onClick={() => setIsMixingEnabled(!isMixingEnabled)}
                    className={`w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm ${
                      isMixingEnabled
                        ? "bg-green-600 text-white"
                        : "bg-gray-700 text-gray-300"
                    }`}
                  >
                    {isMixingEnabled ? (
                      <>
                        <FaMicrophone /> Radio DJ Mode
                      </>
                    ) : (
                      <>
                        <FaMicrophoneSlash /> DJ Mode Off
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
