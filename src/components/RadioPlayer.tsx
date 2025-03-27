import { useEffect, useState, useRef } from "react";
import { useStore } from "../store/useStore";
import { SpeechSegment } from "../store/types";
import {
  FaForward,
  FaBackward,
  FaPlay,
  FaPause,
  FaVolumeUp,
  FaVolumeMute,
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
  const [volume, setVolume] = useState<number>(50);
  const [trackProgress, setTrackProgress] = useState<number>(0);
  const [trackDuration, setTrackDuration] = useState<number>(0);
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

        // Update track progress
        setTrackProgress(state.position);
        setTrackDuration(state.duration);

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

        // Set up progress tracking
        if (progressInterval.current) {
          window.clearInterval(progressInterval.current);
        }
        progressInterval.current = window.setInterval(() => {
          setTrackProgress((prev) => {
            if (isPlaying && prev < trackDuration) {
              return prev + 1000; // Update every second
            }
            return prev;
          });
        }, 1000);
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

    // Pause Spotify playback when speech is playing
    if (isPlaying && player) {
      player.pause();
      setIsPlaying(false);
    }

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
          } catch (playError) {
            console.error("Error starting playback:", playError);
            setError("Failed to start audio playback.");
            handleSpeechEnded();
          }
        };

        // Add event listeners
        audioElement.addEventListener("error", onError);
        audioElement.addEventListener("canplaythrough", onCanPlayThrough);

        // Clean up function
        return () => {
          audioElement.removeEventListener("error", onError);
          audioElement.removeEventListener("canplaythrough", onCanPlayThrough);
          if (audioElement.src.startsWith("blob:")) {
            URL.revokeObjectURL(audioElement.src);
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
    if (!currentSpeechSegment) return;

    // Clear the current speech segment
    setCurrentSpeechSegment(null);

    // Start music playback
    if (currentTrack && spotifyApi && deviceId) {
      try {
        // Start a new playback instead of resuming
        await spotifyApi.player.startResumePlayback(deviceId, undefined, [
          currentTrack.uri,
        ]);
        setIsPlaying(true);

        console.log("Started playback after speech segment ended");
      } catch (err) {
        console.error("Error starting playback after speech:", err);
        setError("Failed to start music after speech introduction.");
      }
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

  // Change volume
  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseInt(e.target.value);
    setVolume(newVolume);
    if (player) {
      player.setVolume(newVolume / 100);
    }
  };

  // Format time (milliseconds to mm:ss)
  const formatTime = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
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
    <div className="bg-gradient-to-br from-gray-800 to-gray-900 text-white rounded-xl shadow-2xl p-6 max-w-2xl mx-auto relative overflow-hidden">
      {/* Background animation */}
      <div className="absolute -top-1/2 -left-1/2 w-[200%] h-[200%] bg-[radial-gradient(circle,rgba(29,185,84,0.05)_0%,transparent_50%)] animate-[spin_15s_linear_infinite] z-0 pointer-events-none"></div>

      {/* Content */}
      <div className="relative z-10">
        <h2 className="text-2xl font-bold mb-6 text-center bg-gradient-to-r from-green-400 to-blue-500 bg-clip-text text-transparent pb-3 border-b border-white/10 tracking-wide">
          Spotify Radio
        </h2>

        {currentTrack && (
          <div>
            <div className="flex items-center gap-6 mb-6">
              {currentTrack.albumImageUrl && (
                <div className="relative group rounded-lg overflow-hidden shadow-lg transition-all duration-300 hover:scale-105 hover:rotate-2 hover:shadow-xl">
                  <img
                    src={currentTrack.albumImageUrl}
                    alt={currentTrack.name}
                    className="w-24 h-24 object-cover rounded-lg"
                  />
                  <div className="absolute inset-0 bg-gradient-to-br from-green-400/30 to-blue-500/30 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                </div>
              )}
              <div className="flex-1">
                <h3 className="text-xl font-bold mb-1 truncate">
                  {currentTrack.name}
                </h3>
                <p className="text-gray-300">
                  {currentTrack.artists.join(", ")}
                </p>
              </div>
            </div>

            {currentSpeechSegment && (
              <div className="bg-blue-900/20 border border-blue-700/30 rounded-lg p-4 mb-6 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-blue-500 to-purple-500"></div>
                <div className="flex items-center mb-2">
                  <div className="w-2 h-2 bg-blue-400 rounded-full mr-2 animate-pulse"></div>
                  <p className="text-blue-300 font-medium">
                    Currently playing speech
                  </p>
                </div>
                <p className="text-gray-200 italic">
                  {currentSpeechSegment.text}
                </p>
              </div>
            )}

            {spotifyApi && currentTrack && accessToken && (
              <div className="mt-4">
                <div className="mb-4 p-4 bg-gray-800/50 rounded-lg border border-gray-700">
                  {/* Progress bar */}
                  <div className="flex justify-between text-xs text-gray-400 mb-1">
                    <span>{formatTime(trackProgress)}</span>
                    <span>{formatTime(trackDuration)}</span>
                  </div>
                  <div className="w-full h-1.5 bg-gray-700 rounded-full mb-3 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-green-500 to-green-400 rounded-full"
                      style={{
                        width:
                          trackDuration > 0
                            ? `${(trackProgress / trackDuration) * 100}%`
                            : "0%",
                      }}
                    ></div>
                  </div>

                  {/* Controls */}
                  <div className="flex justify-between items-center">
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

                {/* Volume control */}
                <div className="flex items-center gap-3 mt-4 p-3 bg-gray-800/30 rounded-lg">
                  <button
                    onClick={() => (volume > 0 ? setVolume(0) : setVolume(50))}
                    className="text-white hover:text-green-400 transition-colors"
                  >
                    {volume === 0 ? <FaVolumeMute /> : <FaVolumeUp />}
                  </button>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={volume}
                    onChange={handleVolumeChange}
                    className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                  />
                  <span className="text-xs text-gray-400 w-8 text-right">
                    {volume}%
                  </span>
                </div>

                {/* Mixing toggle */}
                <div className="mt-6">
                  <button
                    onClick={() => setIsMixingEnabled(!isMixingEnabled)}
                    className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium transition-all duration-200 hover:-translate-y-1 hover:shadow-lg relative overflow-hidden mb-4 ${
                      isMixingEnabled
                        ? "bg-green-600 text-white shadow-green-600/30"
                        : "bg-gray-700 text-gray-300"
                    }`}
                  >
                    <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full hover:translate-x-full transition-transform duration-500"></span>
                    <span className="relative z-10 flex items-center gap-2">
                      {isMixingEnabled ? (
                        <>
                          <FaMicrophone /> Radio DJ Mode Enabled
                        </>
                      ) : (
                        <>
                          <FaMicrophoneSlash /> Radio DJ Mode Disabled
                        </>
                      )}
                    </span>
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
