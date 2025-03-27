import { useEffect, useState } from "react";
import SpotifyWebPlayback from "react-spotify-web-playback";
import { useStore } from "../store/useStore";
import { FaForward, FaMicrophone, FaMicrophoneSlash } from "react-icons/fa";

export default function RadioPlayer() {
  const {
    spotifyApi,
    selectedPlaylist,
    isPlaying,
    setIsPlaying,
    currentTrack,
    setCurrentTrack,
    speechSegments,
    setSpeechSegments,
    currentSpeechSegment,
    setCurrentSpeechSegment,
    isMixingEnabled,
    backendUrl,
  } = useStore();

  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(
    null
  );
  const [isLoadingSpeech, setIsLoadingSpeech] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  // Fetch speech segments when a playlist is selected
  useEffect(() => {
    if (!selectedPlaylist || !isMixingEnabled) return;

    const fetchSpeechSegments = async () => {
      setIsLoadingSpeech(true);
      setError(null);

      try {
        // Fetch speech segments from the backend
        const response = await fetch(
          `${backendUrl}/api/speech?playlistId=${selectedPlaylist.id}`
        );

        if (!response.ok) {
          throw new Error(
            `Failed to fetch speech segments: ${response.statusText}`
          );
        }

        const data = await response.json();
        setSpeechSegments(data.segments);
      } catch (err) {
        console.error("Error fetching speech segments:", err);
        setError("Failed to load speech content. Please try again later.");
      } finally {
        setIsLoadingSpeech(false);
      }
    };

    fetchSpeechSegments();
  }, [selectedPlaylist, isMixingEnabled, backendUrl, setSpeechSegments]);

  // Start playback when a playlist is selected
  useEffect(() => {
    if (
      selectedPlaylist &&
      selectedPlaylist.tracks.length > 0 &&
      !currentTrack
    ) {
      // Start with the first track
      setCurrentTrack(selectedPlaylist.tracks[0]);

      // If mixing is enabled, also set the first speech segment
      if (isMixingEnabled && speechSegments.length > 0) {
        setCurrentSpeechSegment(speechSegments[0]);
      }
    }
  }, [
    selectedPlaylist,
    speechSegments,
    currentTrack,
    setCurrentTrack,
    setCurrentSpeechSegment,
    isMixingEnabled,
  ]);

  // Play speech segment when it changes
  useEffect(() => {
    if (!audioElement || !currentSpeechSegment) return;

    // Pause Spotify playback when speech is playing
    if (isPlaying) {
      setIsPlaying(false);
    }

    // Play the speech segment
    audioElement.src = currentSpeechSegment.audioUrl;
    audioElement.play().catch((err) => {
      console.error("Error playing speech:", err);
      setError("Failed to play speech segment. Please try again.");
      handleSpeechEnded(); // Move to next segment/track
    });
  }, [currentSpeechSegment, audioElement, isPlaying, setIsPlaying]);

  // Handle when speech segment finishes playing
  const handleSpeechEnded = () => {
    if (!currentSpeechSegment || !speechSegments.length) return;

    // Find the current index
    const currentIndex = speechSegments.findIndex(
      (segment) => segment.id === currentSpeechSegment.id
    );

    if (currentIndex < speechSegments.length - 1) {
      // Move to the next speech segment
      setCurrentSpeechSegment(speechSegments[currentIndex + 1]);
    } else {
      // If we've played all speech segments, resume music playback
      setCurrentSpeechSegment(null);
      setIsPlaying(true);
    }
  };

  // Handle Spotify playback state changes
  const handlePlaybackStateChange = (state: {
    isPlaying: boolean;
    isActive: boolean;
  }) => {
    // If the track ended, move to the next track
    if (!state.isPlaying && !state.isActive) {
      handleNextTrack();
    }

    // Update playing state
    setIsPlaying(state.isPlaying);
  };

  // Move to the next track in the playlist
  const handleNextTrack = () => {
    if (!selectedPlaylist || !currentTrack) return;

    const currentIndex = selectedPlaylist.tracks.findIndex(
      (track) => track.id === currentTrack.id
    );

    if (currentIndex < selectedPlaylist.tracks.length - 1) {
      // Move to the next track
      setCurrentTrack(selectedPlaylist.tracks[currentIndex + 1]);

      // If mixing is enabled, also play a speech segment
      if (isMixingEnabled && speechSegments.length > 0) {
        // Choose a random speech segment
        const randomIndex = Math.floor(Math.random() * speechSegments.length);
        setCurrentSpeechSegment(speechSegments[randomIndex]);
      }
    } else {
      // End of playlist
      setCurrentTrack(null);
      setIsPlaying(false);
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
    <div className="bg-gradient-to-br from-gray-800 to-gray-900 text-white rounded-xl shadow-2xl p-6 max-w-2xl mx-auto relative overflow-hidden">
      {/* Background animation */}
      <div className="absolute -top-1/2 -left-1/2 w-[200%] h-[200%] bg-[radial-gradient(circle,rgba(29,185,84,0.05)_0%,transparent_50%)] animate-[spin_15s_linear_infinite] z-0 pointer-events-none"></div>

      {/* Content */}
      <div className="relative z-10">
        <h2 className="text-2xl font-bold mb-6 text-center bg-gradient-to-r from-green-400 to-blue-500 bg-clip-text text-transparent pb-3 border-b border-white/10 tracking-wide">
          Now Playing
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

            {spotifyApi && currentTrack && (
              <div className="mt-4">
                <SpotifyWebPlayback
                  token={spotifyApi.getAccessToken().toString()}
                  uris={[currentTrack.uri]}
                  play={isPlaying && !currentSpeechSegment}
                  callback={handlePlaybackStateChange}
                  styles={{
                    activeColor: "#1DB954",
                    bgColor: "#1e293b",
                    color: "#ffffff",
                    loaderColor: "#1DB954",
                    sliderColor: "#1DB954",
                    trackArtistColor: "#94a3b8",
                    trackNameColor: "#ffffff",
                  }}
                />
              </div>
            )}

            <div className="flex justify-between mt-6">
              <button
                onClick={() =>
                  useStore.getState().setIsMixingEnabled(!isMixingEnabled)
                }
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all duration-200 hover:-translate-y-1 hover:shadow-lg relative overflow-hidden ${
                  isMixingEnabled
                    ? "bg-green-600 text-white shadow-green-600/30"
                    : "bg-gray-700 text-gray-300"
                }`}
              >
                <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full hover:translate-x-full transition-transform duration-500"></span>
                <span className="relative z-10 flex items-center gap-2">
                  {isMixingEnabled ? (
                    <>
                      <FaMicrophone /> Mixing Enabled
                    </>
                  ) : (
                    <>
                      <FaMicrophoneSlash /> Mixing Disabled
                    </>
                  )}
                </span>
              </button>

              <button
                onClick={handleNextTrack}
                className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium bg-blue-600 text-white shadow-blue-600/30 transition-all duration-200 hover:-translate-y-1 hover:shadow-lg hover:bg-blue-700 relative overflow-hidden"
              >
                <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full hover:translate-x-full transition-transform duration-500"></span>
                <span className="relative z-10 flex items-center gap-2">
                  <FaForward /> Next Track
                </span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
